'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Menu, X, ArrowLeft, FileSpreadsheet, RefreshCcw } from 'lucide-react';
import * as XLSX from 'xlsx';

import Sidebar, { tabs } from './Sidebar';
import ReceiptsForm from './ReceiptsForm';
import ExpensesForm from './ExpensesForm';
import VoucherTab from './VoucherTab';
import StatsTab from './StatsTab';
import HistoryTab from './HistoryTab';
import EditEntryModal from './EditEntryModal';
import VoucherDocument from './VoucherDocument';

interface Receipt {
  id: number;
  amount: number;
  source: string;
  description: string;
  date: string;
  paid: string;
  rowIndex?: number;
}

interface Expense {
  id: number;
  amount: number;
  source: string;
  description: string;
  date: string;
  paid: string;
  rowIndex?: number;
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);

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
      const response = await fetch('/api/vouchers');
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
      const response = await fetch('/api/petty-cash?tab=history');
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
      const response = await fetch('/api/vouchers');
      const data = await response.json();
      if (response.ok && data.vouchers) {
        if (data.vouchers.length === 0) {
          setNextVoucherNumber('V-0001');
          return;
        }

        // Get the last voucher number
        const lastVoucher = data.vouchers[data.vouchers.length - 1];
        const lastNum = lastVoucher.number; // e.g., "V-0001"
        if (lastNum && lastNum.includes('-')) {
          const numPart = parseInt(lastNum.split('-')[1]);
          if (!isNaN(numPart)) {
            const nextNum = (numPart + 1).toString().padStart(4, '0');
            setNextVoucherNumber(`V-${nextNum}`);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching next voucher number:', error);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/petty-cash');
      const data = await response.json();

      if (response.ok && data.records) {
        const receiptsData: Receipt[] = [];
        const expensesData: Expense[] = [];

        data.records.forEach((record: any) => {
          const entry = {
            id: record.rowIndex,
            amount: record.amount,
            source: record.name,
            description: record.description,
            date: record.date,
            paid: record.paid || 'No',
            rowIndex: record.rowIndex
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
      const response = await fetch('/api/petty-cash', {
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
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error submitting receipt:', error);
      alert('Error saving receipt');
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
          const response = await fetch('/api/petty-cash', {
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
        return true;
      } else {
        alert('Failed to save expenses. Please check your connection.');
        return false;
      }
    } catch (error) {
      console.error('Error submitting expenses:', error);
      alert('Error saving records');
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
      const response = await fetch('/api/petty-cash', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: selectedEntry.rowIndex,
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
      } else {
        alert(data.error || 'Failed to update entry');
      }
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('Failed to update entry');
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
      const response = await fetch('/api/petty-cash', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: selectedEntry.rowIndex,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await fetchRecords();
        closeModal();
      } else {
        alert(data.error || 'Failed to delete entry');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    } finally {
      setLoading(false);
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
      const response = await fetch('/api/vouchers', {
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

        return true;
      } else {
        alert('Failed to save voucher to Google Sheets');
        return false;
      }
    } catch (error) {
      console.error('Error saving voucher:', error);
      alert('Error saving voucher');
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
  };

  const totalReceipts = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = filteredExpenses.filter(e => e.paid === 'Yes').reduce((sum, e) => sum + e.amount, 0);
  const totalPending = filteredExpenses.filter(e => e.paid === 'No').reduce((sum, e) => sum + e.amount, 0);
  const pendingCount = filteredExpenses.filter(e => e.paid === 'No').length;
  const balance = receipts.reduce((sum, r) => sum + r.amount, 0) - expenses.filter(e => e.paid === 'Yes').reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        balance={balance}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto no-print">
        {/* Top Bar */}
        <div className="bg-white shadow-md p-5 flex items-center gap-4 sticky top-0 z-10 no-print">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors no-print"
            title="Back to Home"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h2 className="text-2xl font-bold text-gray-800">
            {tabs.find(t => t.id === activeTab)?.name}
          </h2>

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
            className={`p-2 rounded-lg hover:bg-gray-100 transition-all ${loading ? 'opacity-50' : 'hover:scale-110 active:scale-95'}`}
            title="Refresh Data"
          >
            <RefreshCcw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {activeTab === 'voucher' && (
            <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl ml-4 border border-gray-100">
              <button
                onClick={() => setVoucherSubTab('add')}
                className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${voucherSubTab === 'add' ? 'bg-white text-cyan-600 shadow-xl shadow-cyan-50' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Add New
              </button>
              <button
                onClick={() => {
                  setVoucherSubTab('reprint');
                  fetchVoucherHistory();
                }}
                className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${voucherSubTab === 'reprint' ? 'bg-white text-cyan-600 shadow-xl shadow-cyan-50' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Reprint
              </button>
            </div>
          )}
          {activeTab === 'stats' && (
            <button
              onClick={exportToExcel}
              className="flex items-center justify-center h-10 w-10 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6">
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
    </div>
  );
}
