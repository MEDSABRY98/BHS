'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  PaginationState,
} from '@tanstack/react-table';
import { InvoiceRow } from '@/types';

interface CustomerDetailsProps {
  customerName: string;
  invoices: InvoiceRow[];
  onBack: () => void;
}

interface InvoiceWithNetDebt extends InvoiceRow {
  netDebt: number;
  residual?: number;
}

interface MonthlyDebt {
  year: string;
  month: string;
  debit: number;
  credit: number;
  netDebt: number;
}

interface AgingSummary {
  atDate: number;
  oneToThirty: number;
  thirtyOneToSixty: number;
  sixtyOneToNinety: number;
  ninetyOneToOneTwenty: number;
  older: number;
  total: number;
}

const invoiceColumnHelper = createColumnHelper<InvoiceWithNetDebt>();
const monthlyColumnHelper = createColumnHelper<MonthlyDebt>();

export default function CustomerDetails({ customerName, invoices, onBack }: CustomerDetailsProps) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'monthly' | 'ages' | 'notes'>('invoices');
  const [invoiceSorting, setInvoiceSorting] = useState<SortingState>([]);
  const [monthlySorting, setMonthlySorting] = useState<SortingState>([]);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('All Months');
  const [selectedMatchingFilter, setSelectedMatchingFilter] = useState<string>('All Matchings');

  // PDF Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'combined' | 'separated'>('combined');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [pdfExportType, setPdfExportType] = useState<'all' | 'net'>('all');
  const [exportScope, setExportScope] = useState<'custom' | 'view'>('custom');

  // Notes State
  const [notes, setNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  const fetchNotes = async () => {
    setLoadingNotes(true);
    try {
      const response = await fetch(`/api/notes?customerName=${encodeURIComponent(customerName)}`);
      const data = await response.json();
      if (data.notes) {
        setNotes(data.notes);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'notes') {
      fetchNotes();
    }
  }, [activeTab, customerName]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const user = currentUser.name || 'Unknown';

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user,
          customerName,
          content: newNote
        }),
      });

      if (response.ok) {
        setNewNote('');
        fetchNotes();
      } else {
        alert('Failed to add note');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Error adding note');
    }
  };

  const handleUpdateNote = async (rowIndex: number) => {
    if (!editingNoteContent.trim()) return;

    try {
      const response = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex,
          content: editingNoteContent
        }),
      });

      if (response.ok) {
        setEditingNoteId(null);
        setEditingNoteContent('');
        fetchNotes();
      } else {
        alert('Failed to update note');
      }
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Error updating note');
    }
  };

  const handleDeleteNote = async (rowIndex: number) => {
    try {
      const response = await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex }),
      });

      if (response.ok) {
        fetchNotes();
      } else {
        alert('Failed to delete note');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Error deleting note');
    }
  };

  // Prepare invoices data with Net Debt and Residual
  const invoicesWithNetDebt = useMemo(() => {
    // 1. Calculate totals for each matching group
    const matchingTotals = new Map<string, number>();
    
    invoices.forEach(inv => {
      if (inv.matching) {
         const currentTotal = matchingTotals.get(inv.matching) || 0;
         matchingTotals.set(inv.matching, currentTotal + (inv.debit - inv.credit));
      }
    });

    // 2. Find the last occurrence index for each matching code (to display residual on the last row)
    const lastMatchingIndices = new Map<string, number>();
    invoices.forEach((inv, index) => {
      if (inv.matching) {
        lastMatchingIndices.set(inv.matching, index);
      }
    });

    // 3. Map invoices preserving original order from Google Sheets
    return invoices.map((invoice, index) => {
      let residual: number | undefined = undefined;

      if (invoice.matching) {
        const lastIndex = lastMatchingIndices.get(invoice.matching);
        // Show residual only on the last invoice of the group (matching the sheet order)
        if (lastIndex === index) {
           const total = matchingTotals.get(invoice.matching) || 0;
           if (Math.abs(total) > 0.01) {
             residual = total;
           }
        }
      }

      return {
        ...invoice,
        netDebt: invoice.debit - invoice.credit,
        residual
      };
    });
  }, [invoices]);

  // Get matchings with residual for filtering
  const availableMatchingsWithResidual = useMemo(() => {
    const matchings = new Set<string>();
    invoicesWithNetDebt.forEach(inv => {
      if (inv.matching && inv.residual !== undefined && Math.abs(inv.residual) > 0.01) {
        matchings.add(inv.matching);
      }
    });
    return Array.from(matchings).sort();
  }, [invoicesWithNetDebt]);

  // Get available months for filtering
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    
    // Filter invoices if a matching is selected
    let relevantInvoices = invoices;

    if (selectedMatchingFilter === 'All Open Matchings') {
       relevantInvoices = invoices.filter(inv => inv.matching && availableMatchingsWithResidual.includes(inv.matching));
    } else if (selectedMatchingFilter !== 'All Matchings') {
      relevantInvoices = invoices.filter(inv => inv.matching === selectedMatchingFilter);
    }

    relevantInvoices.forEach(inv => {
      if (inv.date) {
        const date = new Date(inv.date);
        if (!isNaN(date.getTime())) {
          const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' }); // e.g., January 2025
          monthsSet.add(monthYear);
        }
      }
    });
    // Convert to array and sort by date descending
    return Array.from(monthsSet).sort((a, b) => {
      const dateA = new Date(`1 ${a}`);
      const dateB = new Date(`1 ${b}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, [invoices, selectedMatchingFilter, availableMatchingsWithResidual]);

  // Initialize selected months with all available months
  useEffect(() => {
    setSelectedMonths(availableMonths);
  }, [availableMonths]);

  // Reset selected month if it's no longer available in the filtered list
  useEffect(() => {
    if (selectedMonthFilter !== 'All Months' && !availableMonths.includes(selectedMonthFilter)) {
      setSelectedMonthFilter('All Months');
    }
  }, [availableMonths, selectedMonthFilter]);

  // Prepare monthly debt data
  const monthlyDebt = useMemo(() => {
    const monthlyMap = new Map<string, MonthlyDebt>();

    invoices.forEach((invoice) => {
      if (!invoice.date) return;

      // Parse date to extract year and month
      const date = new Date(invoice.date);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear().toString();
      const month = date.toLocaleString('en-US', { month: 'long' });
      const key = `${year}-${month}`;

      const existing = monthlyMap.get(key) || {
        year,
        month,
        debit: 0,
        credit: 0,
        netDebt: 0,
      };

      existing.debit += invoice.debit;
      existing.credit += invoice.credit;
      existing.netDebt = existing.debit - existing.credit;

      monthlyMap.set(key, existing);
    });

    return Array.from(monthlyMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year.localeCompare(a.year);
      return new Date(`${a.month} 1, ${a.year}`).getTime() - new Date(`${b.month} 1, ${b.year}`).getTime();
    });
  }, [invoices]);

  // Prepare aging data
  const agingData = useMemo<AgingSummary>(() => {
    const totalNetDebt = invoicesWithNetDebt.reduce((sum, inv) => sum + inv.netDebt, 0);
    
    const summary: AgingSummary = {
      atDate: 0,
      oneToThirty: 0,
      thirtyOneToSixty: 0,
      sixtyOneToNinety: 0,
      ninetyOneToOneTwenty: 0,
      older: 0,
      total: totalNetDebt
    };

    if (totalNetDebt <= 0) return summary;

    // Get all debits sorted by due date descending (newest first)
    const debits = invoicesWithNetDebt
      .filter(inv => inv.debit > 0)
      .sort((a, b) => {
         // Prefer Due Date, fallback to Date
         const dateA = a.dueDate ? new Date(a.dueDate) : (a.date ? new Date(a.date) : new Date(0));
         const dateB = b.dueDate ? new Date(b.dueDate) : (b.date ? new Date(b.date) : new Date(0));
         return dateB.getTime() - dateA.getTime();
      });

    let remainingDebt = totalNetDebt;

    for (const inv of debits) {
      if (remainingDebt <= 0) break;

      const amountToAllocate = Math.min(inv.debit, remainingDebt);
      
      // Calculate days overdue
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : (inv.date ? new Date(inv.date) : new Date());
      const today = new Date();
      // Reset time part to ensure accurate day calculation
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - dueDate.getTime();
      const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        summary.atDate += amountToAllocate;
      } else if (daysOverdue <= 30) {
        summary.oneToThirty += amountToAllocate;
      } else if (daysOverdue <= 60) {
        summary.thirtyOneToSixty += amountToAllocate;
      } else if (daysOverdue <= 90) {
        summary.sixtyOneToNinety += amountToAllocate;
      } else if (daysOverdue <= 120) {
        summary.ninetyOneToOneTwenty += amountToAllocate;
      } else {
        summary.older += amountToAllocate;
      }

      remainingDebt -= amountToAllocate;
    }

    return summary;
  }, [invoicesWithNetDebt]);

  // Invoice columns - Order: DATE, NUMBER, DEBIT, CREDIT, Net Debt, Matching, Residual
  const invoiceColumns = useMemo(
    () => [
      invoiceColumnHelper.accessor('date', {
        header: 'Date',
        cell: (info) => {
          const dateStr = info.getValue();
          if (!dateStr) return '';
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return dateStr;
          return `${date.getDate()}-${date.toLocaleDateString('en-US', { month: 'short' })}-${date.getFullYear()}`;
        },
      }),
      invoiceColumnHelper.accessor('number', {
        header: 'Number',
        cell: (info) => info.getValue(),
      }),
      invoiceColumnHelper.accessor('debit', {
        header: 'Debit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      invoiceColumnHelper.accessor('credit', {
        header: 'Credit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      invoiceColumnHelper.accessor('netDebt', {
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
      invoiceColumnHelper.accessor('matching', {
        header: 'Matching',
        cell: (info) => info.getValue() || '-',
      }),
      invoiceColumnHelper.accessor('residual', {
        header: 'Residual',
        cell: (info) => {
          const value = info.getValue();
          // If residual is present and not zero (with small epsilon), show it
          if (value !== undefined && Math.abs(value) > 0.01) {
            return (
              <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-800 font-bold">
                {value.toLocaleString('en-US')}
              </span>
            );
          }
          return null;
        },
      }),
    ],
    []
  );

  // Monthly debt columns - Order: Year, Month, DEBIT, CREDIT, Net Debt
  const monthlyColumns = useMemo(
    () => [
      monthlyColumnHelper.accessor('year', {
        header: 'Year',
        cell: (info) => info.getValue(),
      }),
      monthlyColumnHelper.accessor('month', {
        header: 'Month',
        cell: (info) => info.getValue(),
      }),
      monthlyColumnHelper.accessor('debit', {
        header: 'Debit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      monthlyColumnHelper.accessor('credit', {
        header: 'Credit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      monthlyColumnHelper.accessor('netDebt', {
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
    ],
    []
  );

  // Filter invoices based on selected month filter, matching filter, and search query
  const filteredInvoices = useMemo(() => {
    let filtered = invoicesWithNetDebt;
    
    // Month Filter
    if (selectedMonthFilter !== 'All Months') {
      filtered = filtered.filter((inv) => {
        if (!inv.date) return false;
        const date = new Date(inv.date);
        if (isNaN(date.getTime())) return false;
        const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        return monthYear === selectedMonthFilter;
      });
    }

    // Matching Filter
    if (selectedMatchingFilter !== 'All Matchings') {
      if (selectedMatchingFilter === 'All Open Matchings') {
        filtered = filtered.filter((inv) => inv.matching && availableMatchingsWithResidual.includes(inv.matching));
      } else {
        filtered = filtered.filter((inv) => inv.matching === selectedMatchingFilter);
      }
    }

    // Search Query
    if (invoiceSearchQuery.trim()) {
      const query = invoiceSearchQuery.toLowerCase();
      filtered = filtered.filter((inv) => 
        inv.number.toLowerCase().includes(query) ||
        inv.matching?.toLowerCase().includes(query) ||
        inv.date.toLowerCase().includes(query) ||
        inv.debit.toString().includes(query) ||
        inv.credit.toString().includes(query)
      );
    }
    
    return filtered;
  }, [invoicesWithNetDebt, selectedMonthFilter, selectedMatchingFilter, invoiceSearchQuery]);

  const invoiceTable = useReactTable({
    data: filteredInvoices,
    columns: invoiceColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { 
      sorting: invoiceSorting,
      pagination,
    },
    onSortingChange: setInvoiceSorting,
    onPaginationChange: setPagination,
  });

  const monthlyTable = useReactTable({
    data: monthlyDebt,
    columns: monthlyColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: monthlySorting },
    onSortingChange: setMonthlySorting,
  });

  const totalNetDebt = filteredInvoices.reduce((sum, inv) => sum + inv.netDebt, 0);
  const totalDebit = filteredInvoices.reduce((sum, inv) => sum + inv.debit, 0);
  const totalCredit = filteredInvoices.reduce((sum, inv) => sum + inv.credit, 0);

  const monthlyTotalNetDebt = monthlyDebt.reduce((sum, m) => sum + m.netDebt, 0);
  const monthlyTotalDebit = monthlyDebt.reduce((sum, m) => sum + m.debit, 0);
  const monthlyTotalCredit = monthlyDebt.reduce((sum, m) => sum + m.credit, 0);
  
  const toggleMonthSelection = (month: string) => {
    setSelectedMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  const toggleAllMonths = () => {
    if (selectedMonths.length === availableMonths.length) {
      setSelectedMonths([]);
    } else {
      setSelectedMonths(availableMonths);
    }
  };

  const handleExport = async () => {
    try {
      let finalInvoices = [];
      let monthsLabel = 'All Months';

      if (exportScope === 'view') {
        finalInvoices = filteredInvoices;
        monthsLabel = 'Filtered View';
        
        // If filtering by month, use that name
        if (selectedMonthFilter !== 'All Months') {
           monthsLabel = selectedMonthFilter;
        } else if (selectedMonths.length < availableMonths.length && selectedMonths.length > 0) {
           // If view was constructed differently but matches months logic (unlikely here since filteredInvoices uses selectedMonthFilter)
        }
        
        if (selectedMatchingFilter !== 'All Matchings') {
          monthsLabel += ` - ${selectedMatchingFilter}`;
        }
        
        if (invoiceSearchQuery) {
          monthsLabel += ` (Search: ${invoiceSearchQuery})`;
        }
        
      } else {
        // Custom Selection Logic
        // Filter invoices based on selected months
        finalInvoices = invoicesWithNetDebt.filter(inv => {
          if (!inv.date) return false;
          const date = new Date(inv.date);
          if (isNaN(date.getTime())) return false;
          const monthYear = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          return selectedMonths.includes(monthYear);
        });

        if (finalInvoices.length === 0) {
          alert('Please select at least one month to export.');
          return;
        }

        // Filter for "Net Only" (exclude fully closed matches)
        if (pdfExportType === 'net') {
          // Calculate totals for ALL matchings (global context)
          const matchingTotals = new Map<string, number>();
          invoices.forEach(inv => {
            if (inv.matching) {
               const currentTotal = matchingTotals.get(inv.matching) || 0;
               matchingTotals.set(inv.matching, currentTotal + (inv.debit - inv.credit));
            }
          });

          finalInvoices = finalInvoices.filter(inv => {
            // Keep if no matching ID
            if (!inv.matching) return true;
            
            // Check if the matching group is open (total != 0)
            const total = matchingTotals.get(inv.matching) || 0;
            return Math.abs(total) > 0.01;
          });
        }
        
        // Determine months label for Custom
        if (selectedMonths.length < availableMonths.length) {
            // Sort selected months by date descending
            const sortedSelectedMonths = [...selectedMonths].sort((a, b) => {
              const dateA = new Date(`1 ${a}`);
              const dateB = new Date(`1 ${b}`);
              return dateB.getTime() - dateA.getTime();
            });
            monthsLabel = sortedSelectedMonths.join(', ');
        }
         // Append filter info to label if needed
        if (pdfExportType === 'net') {
           monthsLabel += ' (Net Only)';
        }
      }

      const { generateAccountStatementPDF, generateMonthlySeparatedPDF } = await import('@/lib/pdfUtils');
      
      if (exportMode === 'separated') {
        await generateMonthlySeparatedPDF(customerName, finalInvoices);
      } else {
        await generateAccountStatementPDF(customerName, finalInvoices, false, monthsLabel);
      }
      
      setShowExportModal(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">{customerName}</h2>
          <p className="text-gray-600">Customer Details</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setExportMode('combined');
              setShowExportModal(true);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            📄 Export PDF
          </button>
          <button
            onClick={() => {
              setExportMode('separated');
              setShowExportModal(true);
            }}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
          >
            📑 Export Monthly PDF
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Customers
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Export Options</h3>

            {/* Scope Selection */}
            <div className="mb-4 border-b border-gray-200 pb-4">
              <h4 className="font-semibold mb-2 text-gray-700">Export Scope</h4>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="exportScope"
                    checked={exportScope === 'custom'} 
                    onChange={() => setExportScope('custom')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Custom Selection</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="exportScope"
                    checked={exportScope === 'view'} 
                    onChange={() => setExportScope('view')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Current Filtered View</span>
                </label>
              </div>
            </div>
            
            {exportScope === 'custom' && (
              <>
            <div className="mb-4 border-b border-gray-200 pb-4">
              <h4 className="font-semibold mb-2 text-gray-700">Export Type</h4>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="exportType"
                    checked={pdfExportType === 'all'} 
                    onChange={() => setPdfExportType('all')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">All Transactions</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                  <input 
                    type="radio" 
                    name="exportType"
                    checked={pdfExportType === 'net'} 
                    onChange={() => setPdfExportType('net')}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Net Only (Unmatched & Open)</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer font-bold border-b border-gray-200 pb-2 mb-2">
                <input
                  type="checkbox"
                  checked={selectedMonths.length === availableMonths.length}
                  onChange={toggleAllMonths}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                Select All
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                {availableMonths.map((month) => (
                  <label key={month} className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(month)}
                      onChange={() => toggleMonthSelection(month)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    {month}
                  </label>
                ))}
              </div>
            </div>
              </>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                {exportScope === 'view'
                  ? 'Export Current View'
                  : (exportMode === 'separated' 
                      ? `Export Separate Sheets (${selectedMonths.length})`
                      : `Export PDF (${selectedMonths.length})`)
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="mb-6 flex justify-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'invoices'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'monthly'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Debit by Months
        </button>
        <button
          onClick={() => setActiveTab('ages')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'ages'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Ages
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'notes'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Notes
        </button>
      </div>

      {/* Tab Content: Invoices */}
      {activeTab === 'invoices' && (
        <div>
          <div className="mb-6 flex flex-col gap-4">
            {/* Filters Row */}
            <div className="flex justify-center gap-6">
              {/* Month Filter */}
              <div className="w-64">
                <label htmlFor="monthFilter" className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                  Filter by Month
                </label>
                <select
                  id="monthFilter"
                  value={selectedMonthFilter}
                  onChange={(e) => setSelectedMonthFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="All Months">All Months</option>
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>

              {/* Matching Filter */}
              <div className="w-64">
                <label htmlFor="matchingFilter" className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                  Filter by Open Matching
                </label>
                <select
                  id="matchingFilter"
                  value={selectedMatchingFilter}
                  onChange={(e) => setSelectedMatchingFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="All Matchings">All Matchings</option>
                  <option value="All Open Matchings">All Open Matchings</option>
                  {availableMatchingsWithResidual.map((matching) => (
                    <option key={matching} value={matching}>
                      {matching}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Box */}
            <div className="flex justify-center">
              <div className="w-full max-w-2xl">
                <input
                  type="text"
                  placeholder="Search Invoices (Number, Date, Matching, Amount)..."
                  value={invoiceSearchQuery}
                  onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
            </div>
          </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
              <thead className="bg-gray-100">
                {invoiceTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const getWidth = () => {
                        const columnId = header.column.id;
                        if (columnId === 'date') return '15%';
                        if (columnId === 'number') return '15%';
                        if (columnId === 'debit') return '15%';
                        if (columnId === 'credit') return '15%';
                        if (columnId === 'netDebt') return '15%';
                        if (columnId === 'matching') return '15%';
                        if (columnId === 'residual') return '10%';
                        return '15%';
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
                {invoiceTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => {
                      const getWidth = () => {
                        const columnId = cell.column.id;
                        if (columnId === 'date') return '15%';
                        if (columnId === 'number') return '15%';
                        if (columnId === 'debit') return '15%';
                        if (columnId === 'credit') return '15%';
                        if (columnId === 'netDebt') return '15%';
                        if (columnId === 'matching') return '15%';
                        if (columnId === 'residual') return '10%';
                        return '15%';
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
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                    {totalDebit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                    {totalCredit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}>
                    <span className={totalNetDebt > 0 ? 'text-red-600' : totalNetDebt < 0 ? 'text-green-600' : ''}>
                      {totalNetDebt.toLocaleString('en-US')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '15%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '10%' }}></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 mt-2 rounded-lg shadow">
            <div className="flex justify-between flex-1 sm:hidden">
              <button
                onClick={() => invoiceTable.previousPage()}
                disabled={!invoiceTable.getCanPreviousPage()}
                className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => invoiceTable.nextPage()}
                disabled={!invoiceTable.getCanNextPage()}
                className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700">
                  Page <span className="font-medium">{invoiceTable.getState().pagination.pageIndex + 1}</span> of{' '}
                  <span className="font-medium">{invoiceTable.getPageCount()}</span>
                </span>
                <select
                  value={invoiceTable.getState().pagination.pageSize}
                  onChange={e => {
                    invoiceTable.setPageSize(Number(e.target.value))
                  }}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  {[50, 100, 250, 500].map(pageSize => (
                    <option key={pageSize} value={pageSize}>
                      Show {pageSize}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => invoiceTable.setPageIndex(0)}
                    disabled={!invoiceTable.getCanPreviousPage()}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">First</span>
                    ⟪
                  </button>
                  <button
                    onClick={() => invoiceTable.previousPage()}
                    disabled={!invoiceTable.getCanPreviousPage()}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    ⟨
                  </button>
                  <button
                    onClick={() => invoiceTable.nextPage()}
                    disabled={!invoiceTable.getCanNextPage()}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    ⟩
                  </button>
                  <button
                    onClick={() => invoiceTable.setPageIndex(invoiceTable.getPageCount() - 1)}
                    disabled={!invoiceTable.getCanNextPage()}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Last</span>
                    ⟫
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Tab Content: Monthly Debt */}
      {activeTab === 'monthly' && (
        <div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
              <thead className="bg-gray-100">
                {monthlyTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const getWidth = () => {
                        const columnId = header.column.id;
                        if (columnId === 'year') return '20%';
                        if (columnId === 'month') return '20%';
                        if (columnId === 'debit') return '20%';
                        if (columnId === 'credit') return '20%';
                        if (columnId === 'netDebt') return '20%';
                        return '20%';
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
                {monthlyTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => {
                      const getWidth = () => {
                        const columnId = cell.column.id;
                        if (columnId === 'year') return '20%';
                        if (columnId === 'month') return '20%';
                        if (columnId === 'debit') return '20%';
                        if (columnId === 'credit') return '20%';
                        if (columnId === 'netDebt') return '20%';
                        return '20%';
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
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}></td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    {monthlyTotalDebit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    {monthlyTotalCredit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                    <span className={monthlyTotalNetDebt > 0 ? 'text-red-600' : monthlyTotalNetDebt < 0 ? 'text-green-600' : ''}>
                      {monthlyTotalNetDebt.toLocaleString('en-US')}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* Tab Content: Ages */}
      {activeTab === 'ages' && (
        <div>
          {agingData.total <= 0 ? (
            <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
              <p className="text-lg">No outstanding debt to display aging information.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>AT DATE</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>1 - 30</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>31 - 60</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>61 - 90</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>91 - 120</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>OLDER</th>
                      <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '16%' }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="px-4 py-4 text-center text-lg text-green-600 font-semibold">
                        {agingData.atDate.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.oneToThirty.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.thirtyOneToSixty.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.sixtyOneToNinety.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg">
                        {agingData.ninetyOneToOneTwenty.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg text-red-600 font-semibold">
                        {agingData.older.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-4 text-center text-lg font-bold bg-gray-50">
                        {agingData.total.toLocaleString('en-US')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Notes */}
      {activeTab === 'notes' && (
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold mb-4">Add New Note</h3>
            <div className="flex gap-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Type your note here..."
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
              >
                Add Note
              </button>
            </div>
          </div>

          {loadingNotes ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No notes found for this customer.</p>
              ) : (
                notes.map((note, index) => {
                  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
                  // Robust comparison: check if names exist and match (ignoring case/whitespace)
                  const isAuthor = currentUser?.name && note?.user && 
                                   currentUser.name.trim().toLowerCase() === note.user.trim().toLowerCase();

                  return (
                    <div key={index} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{note.user}</span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">User</span>
                          </div>
                          {note.timestamp && (
                            <span className="text-sm text-gray-500">
                              {new Date(note.timestamp).toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </span>
                          )}
                        </div>
                        {isAuthor && editingNoteId !== note.rowIndex && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingNoteId(note.rowIndex);
                                setEditingNoteContent(note.content);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.rowIndex)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      {editingNoteId === note.rowIndex ? (
                        <div className="mt-2">
                          <textarea
                            value={editingNoteContent}
                            onChange={(e) => setEditingNoteContent(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24 mb-2"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingNoteId(null)}
                              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleUpdateNote(note.rowIndex)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-700 whitespace-pre-wrap text-lg">{note.content}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}