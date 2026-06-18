'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Menu, X, ArrowLeft, FileSpreadsheet, RefreshCcw, Archive } from 'lucide-react';
import * as XLSX from 'xlsx';

import Sidebar, { tabs } from './PettyCashSidebar';
import ReceiptsForm from './ReceiptsForm';
import ExpensesForm from './ExpensesForm';
import VoucherTab from './VoucherTab';
import StatsTab from './StatsTab';
import HistoryTab from './HistoryTab';
import EditEntryModal from './EditEntryModal';
import VoucherDocument from './VoucherDocument';
import { toast } from '@/app/Components/Notification';

interface Receipt {
  id: string;
  amount: number;
  source: string;
  description: string;
  date: string;
  paid: string;
}

interface Expense {
  id: string;
  amount: number;
  source: string;
  description: string;
  date: string;
  paid: string;
}

export default function PettyCashTab() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) { }
    }
  }, []);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<'receipts' | 'expenses' | 'stats' | 'voucher' | 'history'>('receipts');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Load sidebar collapsed state on mount
  useEffect(() => {
    const stored = localStorage.getItem('pettyCashSidebarCollapsed');
    if (stored === 'false') {
      setIsSidebarCollapsed(false);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem('pettyCashSidebarCollapsed', String(nextState));
  };
  const [loading, setLoading] = useState(false);
  const [showBalance, setShowBalance] = useState(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Yes' | 'No'>('All');
  const [recipientFilter, setRecipientFilter] = useState('All');

  // Edit Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [entryType, setEntryType] = useState<'receipt' | 'expense'>('receipt');

  // History States
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Settle Period Modal States
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleDate, setSettleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingDescription, setOpeningDescription] = useState('Opening Balance / رصيد افتتاحي للدورة الجديدة');
  const [settleLoading, setSettleLoading] = useState(false);

  // Voucher Printing States
  const [nextVoucherNumber, setNextVoucherNumber] = useState('V-0001');
  const [voucherSubTab, setVoucherSubTab] = useState<'add' | 'reprint'>('add');
  const [voucherHistory, setVoucherHistory] = useState<any[]>([]);
  const [printData, setPrintData] = useState({
    voucherNumber: '',
    date: '',
    amount: '',
    source: '',
    description: ''
  });

  // Fetch records from Google Sheets on mount
  useEffect(() => {
    fetchRecords();
    fetchNextVoucherNumber();
    fetchVoucherHistory();
  }, []);

  const fetchVoucherHistory = async () => {
    try {
      const response = await fetch('/api/Vouchers');
      const data = await response.json();
      if (response.ok && data.vouchers) {
        setVoucherHistory(data.vouchers.reverse()); // Show newest first
      }
    } catch (error) {
      console.error('Error fetching voucher history:', error);
    }
  };

  const fetchHistoryRecords = async () => {
    try {
      setHistoryLoading(true);
      const response = await fetch('/api/PettyCash?tab=history');
      const data = await response.json();
      if (response.ok && data.records) {
        setHistoryRecords(data.records);
      }
    } catch (error) {
      console.error('Error fetching history records:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistoryRecords();
    }
  }, [activeTab]);

  const fetchNextVoucherNumber = async () => {
    try {
      const response = await fetch('/api/Vouchers');
      const data = await response.json();
      if (response.ok && data.vouchers) {
        if (data.vouchers.length === 0) {
          setNextVoucherNumber('V-0001');
          return;
        }

        // Get the maximum voucher number parsed from all entries
        let maxNum = 0;
        data.vouchers.forEach((v: any) => {
          if (v.number && v.number.includes('-')) {
            const parts = v.number.split('-');
            const numPart = parseInt(parts[parts.length - 1]);
            if (!isNaN(numPart) && numPart > maxNum) {
              maxNum = numPart;
            }
          }
        });

        const nextNum = (maxNum + 1).toString().padStart(4, '0');
        setNextVoucherNumber(`V-${nextNum}`);
      }
    } catch (error) {
      console.error('Error fetching next voucher number:', error);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/PettyCash');
      const data = await response.json();

      if (response.ok && data.records) {
        const receiptsData: Receipt[] = [];
        const expensesData: Expense[] = [];

        data.records.forEach((record: any) => {
          const entry = {
            id: record.id,
            amount: record.amount,
            source: record.name,
            description: record.description,
            date: record.date,
            paid: record.paid || 'No',
          };

          if (record.type === 'Receipt') {
            receiptsData.push(entry);
          } else {
            expensesData.push(entry);
          }
        });

        setReceipts(receiptsData);
        setExpenses(expensesData);
      }
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    window.location.href = '/';
  };

  const handleAddReceipt = async (formData: {
    amount: string;
    source: string;
    description: string;
    paid: string;
    date: string;
  }): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await fetch('/api/PettyCash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          type: 'Receipt',
          amount: parseFloat(formData.amount),
          name: formData.source,
          description: formData.description,
          paid: formData.paid,
        }),
      });

      if (response.ok) {
        await fetchRecords();
        toast.success('Receipt saved successfully');
        return true;
      }

      const data = await response.json().catch(() => ({}));
      toast.error(data.details || data.error || 'Error saving receipt');
      return false;
    } catch (error) {
      console.error('Error submitting receipt:', error);
      toast.error('Error saving receipt');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpenses = async (cart: {
    amount: string;
    source: string;
    description: string;
    paid: string;
    date: string;
  }[]): Promise<boolean> => {
    try {
      setLoading(true);
      let successCount = 0;
      for (const row of cart) {
        try {
          const response = await fetch('/api/PettyCash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: row.date,
              type: 'Expense',
              amount: parseFloat(row.amount),
              name: row.source,
              description: row.description,
              paid: row.paid,
            }),
          });
          if (response.ok) successCount++;
        } catch (e) {
          console.error('Failed to save row:', row, e);
        }
      }

      if (successCount > 0) {
        await fetchRecords();
        setActiveTab('stats');
        toast.success(`${successCount} expense${successCount > 1 ? 's' : ''} saved successfully`);
        return true;
      }

      toast.error('Failed to save expenses. Please check your connection.');
      return false;
    } catch (error) {
      console.error('Error submitting expenses:', error);
      toast.error('Error saving records');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (entry: any, type: 'receipt' | 'expense') => {
    setSelectedEntry(entry);
    setEntryType(type);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEntry(null);
  };

  const handleUpdateEntry = async (updatedFormData: {
    date: string;
    amount: string;
    source: string;
    description: string;
    paid: string;
  }) => {
    if (!selectedEntry) return;

    try {
      setLoading(true);
      const response = await fetch('/api/PettyCash', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedEntry.id,
          date: updatedFormData.date,
          type: entryType === 'receipt' ? 'Receipt' : 'Expense',
          amount: parseFloat(updatedFormData.amount),
          name: updatedFormData.source,
          description: updatedFormData.description,
          paid: updatedFormData.paid,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await fetchRecords();
        closeModal();
        toast.success('Entry updated successfully');
      } else {
        toast.error(data.details || data.error || 'Failed to update entry');
      }
    } catch (error) {
      console.error('Error updating entry:', error);
      toast.error('Failed to update entry');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!selectedEntry) return;

    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/PettyCash', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedEntry.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await fetchRecords();
        closeModal();
        toast.success('Entry deleted successfully');
      } else {
        toast.error(data.details || data.error || 'Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
    } finally {
      setLoading(false);
    }
  };

  // Handler for closing/settling active petty cash period
  const handleSettlePeriod = async () => {
    const loadingId = toast.loading('Closing and archiving current period...', { id: 'petty_cash_settle' });
    try {
      setSettleLoading(true);
      const response = await fetch('/api/PettyCash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'settle',
          liquidationDate: settleDate,
          openingAmount: openingAmount ? parseFloat(openingAmount) : 0,
          openingDescription: openingDescription || 'Opening Balance / رصيد افتتاحي للدورة الجديدة',
        })
      });

      if (response.ok) {
        toast.dismiss(loadingId);
        setOpeningAmount('');
        setIsSettleModalOpen(false);
        await fetchRecords();
        await fetchHistoryRecords();
        toast.success('Period closed and archived successfully!');
      } else {
        toast.dismiss(loadingId);
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.details || errData.error || 'Failed to settle current period');
      }
    } catch (error) {
      toast.dismiss(loadingId);
      console.error('Error settling period:', error);
      toast.error('Failed to settle current period');
    } finally {
      setSettleLoading(false);
    }
  };

  const handlePrintVoucher = async (formData: {
    date: string;
    amount: string;
    source: string;
    description: string;
  }): Promise<boolean> => {
    try {
      setLoading(true);
      // Save to Google Sheets first
      const response = await fetch('/api/Vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          voucherNumber: nextVoucherNumber,
          receiptName: formData.source,
          amount: parseFloat(formData.amount),
          description: formData.description,
        }),
      });

      if (response.ok) {
        setPrintData({
          voucherNumber: nextVoucherNumber,
          date: formData.date,
          amount: formData.amount,
          source: formData.source,
          description: formData.description
        });

        // Direct print in the same window
        setTimeout(async () => {
          window.print();
          await fetchNextVoucherNumber();
          await fetchVoucherHistory();
        }, 100);

        toast.success('Voucher saved successfully');
        return true;
      }

      toast.error('Failed to save voucher to Google Sheets');
      return false;
    } catch (error) {
      console.error('Error saving voucher:', error);
      toast.error('Error saving voucher');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleReprintVoucher = (voucher: any) => {
    setPrintData({
      amount: voucher.amount.toString(),
      source: voucher.receiptName,
      description: voucher.description,
      date: voucher.date,
      voucherNumber: voucher.number
    });
    // Wait for state to update then print
    setTimeout(() => {
      window.print();
      // After printing, refresh next voucher number to be safe
      fetchNextVoucherNumber();
    }, 100);
  };

  // Get unique recipients from expenses for the filter
  const uniqueRecipients = useMemo(() => {
    const recipients = new Set(expenses.map(e => e.source));
    return ['All', ...Array.from(recipients).sort()];
  }, [expenses]);

  // Filter data based on search and date range
  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      if (fromDate && receipt.date < fromDate) return false;
      if (toDate && receipt.date > toDate) return false;
      if (statusFilter !== 'All' && receipt.paid !== statusFilter) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          receipt.source.toLowerCase().includes(query) ||
          receipt.description.toLowerCase().includes(query) ||
          receipt.amount.toString().includes(query) ||
          receipt.date.includes(query)
        );
      }
      return true;
    });
  }, [receipts, searchQuery, fromDate, toDate, statusFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      if (fromDate && expense.date < fromDate) return false;
      if (toDate && expense.date > toDate) return false;
      if (statusFilter !== 'All' && expense.paid !== statusFilter) return false;
      if (recipientFilter !== 'All' && expense.source !== recipientFilter) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          expense.source.toLowerCase().includes(query) ||
          expense.description.toLowerCase().includes(query) ||
          expense.amount.toString().includes(query) ||
          expense.date.includes(query)
        );
      }
      return true;
    });
  }, [expenses, searchQuery, fromDate, toDate, statusFilter, recipientFilter]);

  // Pending Payments - Calculate unpaid amounts per recipient
  const pendingPayments = useMemo(() => {
    const unpaidExpenses = filteredExpenses.filter(e => e.paid === 'No');

    const grouped: { [key: string]: number } = {};
    unpaidExpenses.forEach(expense => {
      const recipient = expense.source.trim();
      if (!grouped[recipient]) {
        grouped[recipient] = 0;
      }
      grouped[recipient] += expense.amount;
    });

    return Object.entries(grouped)
      .map(([recipient, amount]) => ({ recipient, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  const exportToExcel = () => {
    const receiptsData = filteredReceipts.slice().reverse().map(receipt => ({
      'Date': receipt.date,
      'Amount': receipt.amount,
      'Source': receipt.source,
      'Description': receipt.description,
      'Paid': receipt.paid
    }));

    const expensesData = filteredExpenses.slice().reverse().map(expense => ({
      'Date': expense.date,
      'Amount': expense.amount,
      'Recipient': expense.source,
      'Description': expense.description,
      'Paid': expense.paid
    }));

    const workbook = XLSX.utils.book_new();

    const receiptsSheet = XLSX.utils.json_to_sheet(receiptsData);
    XLSX.utils.book_append_sheet(workbook, receiptsSheet, 'Receipts Tracking');

    const expensesSheet = XLSX.utils.json_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Expenses Tracking');

    const date = new Date().toISOString().split('T')[0];
    const filename = `Petty_Cash_Statistics_${date}.xlsx`;

    XLSX.writeFile(workbook, filename);
    toast.success(`Exported to ${filename}`);
  };

  const totalReceipts = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = filteredExpenses.filter(e => e.paid === 'Yes').reduce((sum, e) => sum + e.amount, 0);
  const totalPending = filteredExpenses.filter(e => e.paid === 'No').reduce((sum, e) => sum + e.amount, 0);
  const pendingCount = filteredExpenses.filter(e => e.paid === 'No').length;
  const balance = receipts.reduce((sum, r) => sum + r.amount, 0) - expenses.filter(e => e.paid === 'Yes').reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex min-h-screen w-full bg-[#F8F9FA] text-black">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          balance={balance}
          showBalance={showBalance}
          setShowBalance={setShowBalance}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          balance={balance}
          showBalance={showBalance}
          setShowBalance={setShowBalance}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300 min-h-screen`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300 no-print">
          <div className="max-w-[98%] mx-auto px-4 py-3 flex items-center justify-between gap-4 min-h-[5rem]">
            {/* Left section: Hamburger for Mobile & Refresh */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsMobileSidebarOpen(true)} 
                className="p-2.5 text-slate-600 hover:text-slate-900 lg:hidden rounded-xl hover:bg-slate-100 transition-all"
                title="Open Navigation Menu"
              >
                <Menu className="w-6 h-6" />
              </button>

              <button
                onClick={() => {
                  fetchRecords();
                  fetchNextVoucherNumber();
                  fetchVoucherHistory();
                  if (activeTab === 'history') {
                    fetchHistoryRecords();
                  }
                }}
                disabled={loading}
                className={`p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50 transition-all ${loading ? 'opacity-50' : 'hover:scale-105 active:scale-95'}`}
                title="Refresh Data"
              >
                <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Middle Section: Display Active Tab Label or Voucher Sub-tabs */}
            <div className="flex items-center gap-2">
              {activeTab === 'voucher' ? (
                <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                  <button
                    onClick={() => setVoucherSubTab('add')}
                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${voucherSubTab === 'add' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Add New
                  </button>
                  <button
                    onClick={() => {
                      setVoucherSubTab('reprint');
                      fetchVoucherHistory();
                    }}
                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${voucherSubTab === 'reprint' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Reprint
                  </button>
                </div>
              ) : (
                <span className="hidden md:inline text-lg font-extrabold text-slate-800 tracking-tight">
                  {tabs.find(t => t.id === activeTab)?.name || 'Petty Cash'}
                </span>
              )}
            </div>

            {/* Right Section: Export or Voucher actions */}
            <div className="flex items-center gap-3">
              {activeTab === 'stats' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSettleDate(new Date().toISOString().split('T')[0]);
                      setIsSettleModalOpen(true);
                    }}
                    className="flex items-center justify-center h-10 w-10 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl shadow-md transition-all hover:scale-105 active:scale-95"
                    title="Close current active period and archive records"
                  >
                    <Archive className="w-5 h-5" />
                  </button>
                  <button
                    onClick={exportToExcel}
                    className="flex items-center justify-center h-10 w-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all hover:scale-105 active:scale-95"
                    title="Export to Excel"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 max-w-[98%] mx-auto w-full flex-1">
          {activeTab === 'receipts' && (
            <ReceiptsForm loading={loading} onSubmit={handleAddReceipt} />
          )}

          {activeTab === 'expenses' && (
            <ExpensesForm loading={loading} onSubmit={handleAddExpenses} />
          )}

          {activeTab === 'stats' && (
            <StatsTab
              receipts={receipts}
              expenses={expenses}
              filteredReceipts={filteredReceipts}
              filteredExpenses={filteredExpenses}
              pendingPayments={pendingPayments}
              totalReceipts={totalReceipts}
              totalExpenses={totalExpenses}
              totalPending={totalPending}
              balance={balance}
              pendingCount={pendingCount}
              showBalance={showBalance}
              setShowBalance={setShowBalance}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              recipientFilter={recipientFilter}
              setRecipientFilter={setRecipientFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              fromDate={fromDate}
              setFromDate={setFromDate}
              toDate={toDate}
              setToDate={setToDate}
              uniqueRecipients={uniqueRecipients}
              onOpenEditModal={openEditModal}
            />
          )}

          {activeTab === 'voucher' && (
            <VoucherTab
              loading={loading}
              nextVoucherNumber={nextVoucherNumber}
              voucherSubTab={voucherSubTab}
              setVoucherSubTab={setVoucherSubTab}
              voucherHistory={voucherHistory}
              onPrint={handlePrintVoucher}
              onReprint={handleReprintVoucher}
            />
          )}

          {activeTab === 'history' && (
            <HistoryTab
              records={historyRecords}
              loading={historyLoading}
            />
          )}
        </div>
      </div>

      {/* Hidden container for global printing - MATCHING CASH RECEIPT LOGIC */}
      <div id="voucher-print" className="hidden-print m-0 p-0" style={{ width: '210mm' }}>
        <VoucherDocument data={printData} />
      </div>

      <style jsx global>{`
        @media screen {
          .hidden-print { position: absolute; left: -9999px; }
          /* Hide number input arrows */
          input[type=number]::-webkit-inner-spin-button, 
          input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
          }
          input[type=number] {
            -moz-appearance: textfield;
          }
        }
        @media print {
          .no-print { display: none !important; }
          .hidden-print { display: block !important; position: static !important; width: 100% !important; height: auto !important; overflow: hidden !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; height: auto !important; min-height: initial !important; }
          html { height: auto !important; }
          #voucher-print { border: none !important; box-shadow: none !important; width: 210mm !important; margin: 0 auto !important; }
          @page { size: A4 portrait; margin: 5mm; }
        }
      `}</style>

      {/* Edit/Delete Modal */}
      <EditEntryModal
        isOpen={isModalOpen}
        onClose={closeModal}
        entry={selectedEntry}
        entryType={entryType}
        onUpdate={handleUpdateEntry}
        onDelete={handleDeleteEntry}
        loading={loading}
      />

      {/* Settle Period Modal */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            <header className="px-6 py-4 bg-gradient-to-r from-cyan-800 to-slate-900 text-white flex justify-between items-center">
              <h3 className="text-lg font-black tracking-wide uppercase">Close Period & Archive</h3>
              <button 
                onClick={() => setIsSettleModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </header>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="bg-amber-50 border-2 border-amber-100 rounded-xl p-4 text-sm text-amber-800 space-y-1 font-semibold">
                <p className="font-bold text-amber-900">⚠️ Warning:</p>
                <p>This will move all current active receipts and expenses into the History archive and clear the active Petty Cash tracking sheet. This action cannot be undone.</p>
              </div>

              <div className="space-y-4">
                {/* Date Input */}
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                    Liquidation Date
                  </label>
                  <input
                    type="date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 focus:border-cyan-500 rounded-xl focus:outline-none font-bold"
                  />
                </div>

                {/* Opening Balance Amount */}
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                    Opening Balance Amount (AED)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 focus:border-cyan-500 rounded-xl focus:outline-none font-bold"
                  />
                  <p className="text-xs text-gray-400 mt-1">Leave blank or enter 0 to start next period with a zero balance.</p>
                </div>

                {/* Opening Balance Description */}
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                    Opening Balance Description
                  </label>
                  <input
                    type="text"
                    value={openingDescription}
                    onChange={(e) => setOpeningDescription(e.target.value)}
                    placeholder="Opening Balance"
                    className="w-full px-4 py-2.5 border-2 border-gray-200 focus:border-cyan-500 rounded-xl focus:outline-none font-bold"
                  />
                </div>
              </div>
            </div>

            <footer className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                disabled={settleLoading}
                className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 border-2 border-gray-200 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSettlePeriod}
                disabled={settleLoading}
                className="px-5 py-2.5 text-sm font-black text-white bg-cyan-700 hover:bg-cyan-800 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {settleLoading ? 'Processing...' : 'Confirm & Close'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
