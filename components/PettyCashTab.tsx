'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, FileText, TrendingDown, TrendingUp, BarChart3, Menu, X, Wallet, ArrowLeft, FileSpreadsheet, Search, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<'receipts' | 'expenses' | 'stats' | 'voucher'>('receipts');
  const [statsSubTab, setStatsSubTab] = useState<'receipts' | 'expenses' | 'pending'>('receipts');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Yes' | 'No'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Receipt | Expense | null>(null);
  const [entryType, setEntryType] = useState<'receipt' | 'expense'>('receipt');
  const [editFormData, setEditFormData] = useState({
    date: '',
    amount: '',
    source: '',
    description: '',
    paid: ''
  });
  const [receiptFormData, setReceiptFormData] = useState({
    amount: '',
    source: '',
    description: '',
    paid: 'No',
    date: new Date().toISOString().split('T')[0]
  });
  const [expenseFormData, setExpenseFormData] = useState({
    amount: '',
    source: '',
    description: '',
    paid: 'No',
    date: new Date().toISOString().split('T')[0]
  });

  const [voucherFormData, setVoucherFormData] = useState({
    amount: '',
    source: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Fetch records from Google Sheets on component mount
  useEffect(() => {
    fetchRecords();
  }, []);

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

  const handleSubmit = async (type: 'receipt' | 'expense') => {
    const currentFormData = type === 'receipt' ? receiptFormData : expenseFormData;

    if (!currentFormData.amount || !currentFormData.source || !currentFormData.description) {
      alert('Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/petty-cash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: currentFormData.date,
          type: type === 'receipt' ? 'Receipt' : 'Expense',
          amount: parseFloat(currentFormData.amount),
          name: currentFormData.source,
          description: currentFormData.description,
          paid: currentFormData.paid,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh records from server
        await fetchRecords();

        // Reset the appropriate form
        if (type === 'receipt') {
          setReceiptFormData({
            amount: '',
            source: '',
            description: '',
            paid: 'No',
            date: new Date().toISOString().split('T')[0]
          });
        } else {
          setExpenseFormData({
            amount: '',
            source: '',
            description: '',
            paid: 'No',
            date: new Date().toISOString().split('T')[0]
          });
        }
      } else {
        alert(data.error || 'Failed to save entry');
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('Failed to save entry');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (entry: Receipt | Expense, type: 'receipt' | 'expense') => {
    setSelectedEntry(entry);
    setEntryType(type);
    setEditFormData({
      date: entry.date,
      amount: entry.amount.toString(),
      source: entry.source,
      description: entry.description,
      paid: entry.paid || 'No'
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEntry(null);
    setEditFormData({
      date: '',
      amount: '',
      source: '',
      description: '',
      paid: ''
    });
  };

  const handleUpdateEntry = async () => {
    if (!selectedEntry) return;

    if (!editFormData.date || !editFormData.amount || !editFormData.source || !editFormData.description) {
      alert('Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/petty-cash', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: selectedEntry.rowIndex,
          date: editFormData.date,
          type: entryType === 'receipt' ? 'Receipt' : 'Expense',
          amount: parseFloat(editFormData.amount),
          name: editFormData.source,
          description: editFormData.description,
          paid: editFormData.paid,
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

  const deleteEntry = async (id: number, type: 'receipt' | 'expense') => {
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
          rowIndex: id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh records from server
        await fetchRecords();
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

  // Filter data based on search and date range
  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      // Date filter
      if (fromDate && receipt.date < fromDate) return false;
      if (toDate && receipt.date > toDate) return false;

      // Status filter
      if (statusFilter !== 'All' && receipt.paid !== statusFilter) return false;

      // Search filter
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
      // Date filter
      if (fromDate && expense.date < fromDate) return false;
      if (toDate && expense.date > toDate) return false;

      // Status filter
      if (statusFilter !== 'All' && expense.paid !== statusFilter) return false;

      // Search filter
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
  }, [expenses, searchQuery, fromDate, toDate, statusFilter]);

  // Pending Payments - Calculate unpaid amounts per recipient
  const pendingPayments = useMemo(() => {
    const unpaidExpenses = expenses.filter(e => e.paid === 'No');

    // Group by recipient and sum amounts
    const grouped: { [key: string]: number } = {};
    unpaidExpenses.forEach(expense => {
      const recipient = expense.source.trim();
      if (!grouped[recipient]) {
        grouped[recipient] = 0;
      }
      grouped[recipient] += expense.amount;
    });

    // Convert to array and sort by amount descending
    return Object.entries(grouped)
      .map(([recipient, amount]) => ({ recipient, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const exportToExcel = () => {
    // Prepare Receipts data (use filtered data)
    const receiptsData = filteredReceipts.slice().reverse().map(receipt => ({
      'Date': receipt.date,
      'Amount': receipt.amount,
      'Source': receipt.source,
      'Description': receipt.description,
      'Paid': receipt.paid
    }));

    // Prepare Expenses data (use filtered data)
    const expensesData = filteredExpenses.slice().reverse().map(expense => ({
      'Date': expense.date,
      'Amount': expense.amount,
      'Recipient': expense.source,
      'Description': expense.description,
      'Paid': expense.paid
    }));

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Create Receipts sheet
    const receiptsSheet = XLSX.utils.json_to_sheet(receiptsData);
    XLSX.utils.book_append_sheet(workbook, receiptsSheet, 'Receipts Tracking');

    // Create Expenses sheet
    const expensesSheet = XLSX.utils.json_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Expenses Tracking');

    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `Petty_Cash_Statistics_${date}.xlsx`;

    // Write and download
    XLSX.writeFile(workbook, filename);
  };

  const totalReceipts = receipts.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balance = totalReceipts - totalExpenses;

  const tabs = [
    { id: 'receipts' as const, name: 'Receipts', icon: TrendingUp },
    { id: 'expenses' as const, name: 'Expenses', icon: TrendingDown },
    { id: 'voucher' as const, name: 'Voucher (Print)', icon: FileText },
    { id: 'stats' as const, name: 'Statistics', icon: BarChart3 }
  ];

  const handlePrintOnlyVoucher = () => {
    if (!voucherFormData.amount || !voucherFormData.source || !voucherFormData.description) {
      alert('Please fill all fields');
      return;
    }

    // Direct print in the same window using an iframe approach or temporary div + print()
    // A clean way is window.print() with CSS hiding everything else.
    window.print();
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} bg-white text-gray-900 transition-all duration-300 overflow-hidden shadow-2xl border-r border-gray-200 no-print`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10 pb-6 border-b border-gray-200">
            <div className="bg-cyan-100 text-cyan-600 p-2 rounded-lg">
              <Wallet className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Petty Cash</h1>
            </div>
          </div>

          <nav className="space-y-2 mb-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all duration-200 ${activeTab === tab.id
                    ? 'bg-cyan-100 text-cyan-700 shadow-lg transform scale-105'
                    : 'hover:bg-gray-100 hover:transform hover:translate-x-1 text-gray-700'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-semibold">{tab.name}</span>
                </button>
              );
            })}
          </nav>

          <div className="bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border-2 border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <div className="text-xs text-gray-600 font-semibold">Current Balance</div>
            </div>
            <div className="text-3xl font-bold mb-1 text-gray-900">{balance.toFixed(2)} AED</div>
            <div className="text-sm text-gray-600">UAE Dirham</div>
          </div>
        </div>
      </div>

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
          {activeTab === 'stats' && (
            <button
              onClick={exportToExcel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-green-600 hover:text-green-700"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Receipts Tab */}
          {activeTab === 'receipts' && (
            <div className="max-w-7xl mx-auto">
              <div className="space-y-6">
                {/* Form Card */}
                <div>
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-black text-white p-2 rounded-lg">
                        <Plus className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-bold">New Receipt</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Date</label>
                          <input
                            type="date"
                            value={receiptFormData.date}
                            onChange={(e) => setReceiptFormData({ ...receiptFormData, date: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            value={receiptFormData.amount}
                            onChange={(e) => setReceiptFormData({ ...receiptFormData, amount: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Source</label>
                          <input
                            type="text"
                            value={receiptFormData.source}
                            onChange={(e) => setReceiptFormData({ ...receiptFormData, source: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                            placeholder="Source name"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Paid?</label>
                          <select
                            value={receiptFormData.paid}
                            onChange={(e) => setReceiptFormData({ ...receiptFormData, paid: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold mb-2 text-sm text-gray-700">Description</label>
                        <textarea
                          value={receiptFormData.description}
                          onChange={(e) => setReceiptFormData({ ...receiptFormData, description: e.target.value })}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors resize-none"
                          rows={3}
                          placeholder="Receipt description"
                        />
                      </div>

                      <button
                        onClick={() => handleSubmit('receipt')}
                        disabled={loading}
                        className="w-1/2 mx-auto bg-black text-white font-bold py-4 px-4 rounded-xl hover:bg-gray-800 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-5 h-5" />
                        {loading ? 'Saving...' : 'Add Receipt'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Expenses Tab */}
          {activeTab === 'expenses' && (
            <div className="max-w-7xl mx-auto">
              <div className="space-y-6">
                {/* Form Card */}
                <div>
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-black text-white p-2 rounded-lg">
                        <Plus className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-bold">New Expense</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Date</label>
                          <input
                            type="date"
                            value={expenseFormData.date}
                            onChange={(e) => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            value={expenseFormData.amount}
                            onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Recipient</label>
                          <input
                            type="text"
                            value={expenseFormData.source}
                            onChange={(e) => setExpenseFormData({ ...expenseFormData, source: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                            placeholder="Recipient name"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Paid?</label>
                          <select
                            value={expenseFormData.paid}
                            onChange={(e) => setExpenseFormData({ ...expenseFormData, paid: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold mb-2 text-sm text-gray-700">Description</label>
                        <textarea
                          value={expenseFormData.description}
                          onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors resize-none"
                          rows={3}
                          placeholder="Expense description"
                        />
                      </div>

                      <button
                        onClick={() => handleSubmit('expense')}
                        disabled={loading}
                        className="w-1/2 mx-auto bg-black text-white font-bold py-4 px-4 rounded-xl hover:bg-gray-800 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-5 h-5" />
                        {loading ? 'Saving...' : 'Add Expense'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === 'stats' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="grid grid-cols-3 gap-4 md:gap-6">
                <div className="bg-gradient-to-br from-green-50 to-white rounded-xl shadow-lg p-4 border-2 border-green-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-green-500 text-white p-2 rounded-lg">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Total Receipts</h3>
                  </div>
                  <p className="text-2xl font-bold mb-1 text-gray-900">{totalReceipts.toFixed(2)}</p>
                  <p className="text-xs text-gray-600 mb-3">AED</p>
                  <div className="pt-3 border-t border-green-100">
                    <p className="text-xs text-gray-600">Transactions: <span className="font-bold">{receipts.length}</span></p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-white rounded-xl shadow-lg p-4 border-2 border-red-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-red-500 text-white p-2 rounded-lg">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-800">Total Expenses</h3>
                  </div>
                  <p className="text-2xl font-bold mb-1 text-gray-900">{totalExpenses.toFixed(2)}</p>
                  <p className="text-xs text-gray-600 mb-3">AED</p>
                  <div className="pt-3 border-t border-red-100">
                    <p className="text-xs text-gray-600">Transactions: <span className="font-bold">{expenses.length}</span></p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-900 to-black text-white rounded-xl shadow-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-white text-black p-2 rounded-lg">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold">Current Balance</h3>
                  </div>
                  <p className="text-2xl font-bold mb-1">{balance.toFixed(2)}</p>
                  <p className="text-xs text-gray-300 mb-3">AED</p>
                  <div className="pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-300">
                      {balance > 0 ? '✓ Positive' : balance < 0 ? '✗ Deficit' : '• Balanced'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Search and Date Filter */}
              <div className="bg-white rounded-xl shadow-lg p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Search Box */}
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search by source, description, amount, or date..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div className="md:w-48">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors bg-white font-semibold text-gray-700"
                    >
                      <option value="All">All Status</option>
                      <option value="Yes">PAID</option>
                      <option value="No">UNPAID</option>
                    </select>
                  </div>

                  {/* Date Filters */}
                  <div className="flex gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        placeholder="From Date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 font-semibold">To</span>
                      <input
                        type="date"
                        placeholder="To Date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub Tabs */}
              <div className="bg-white rounded-xl shadow-lg p-2">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setStatsSubTab('receipts')}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${statsSubTab === 'receipts'
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    Receipts Tracking
                  </button>
                  <button
                    onClick={() => setStatsSubTab('expenses')}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${statsSubTab === 'expenses'
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    Expenses Tracking
                  </button>
                  <button
                    onClick={() => setStatsSubTab('pending')}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${statsSubTab === 'pending'
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    Pending Payments
                  </button>
                </div>

                <div className="p-4">
                  {statsSubTab === 'receipts' ? (
                    <>
                      {filteredReceipts.length === 0 ? (
                        <p className="text-center text-gray-400 py-12">No receipts available</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b-2 border-gray-200">
                                <th className="text-center py-3 px-3 text-base font-bold text-gray-700">Date</th>
                                <th className="text-center py-3 px-3 text-base font-bold text-gray-700">Amount</th>
                                <th className="text-center py-3 px-3 text-base font-bold text-gray-700">Source</th>
                                <th className="text-center py-3 px-3 text-base font-bold text-gray-700">Description</th>
                                <th className="text-center py-3 px-3 text-base font-bold text-gray-700">Paid?</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredReceipts.slice().sort((a, b) => b.date.localeCompare(a.date)).map((receipt, index) => (
                                <tr
                                  key={receipt.id}
                                  onClick={() => openEditModal(receipt, 'receipt')}
                                  className={`border-b border-gray-100 hover:bg-green-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                >
                                  <td className="py-3 px-3 text-center text-base text-gray-600">{receipt.date}</td>
                                  <td className="py-3 px-3 text-center text-base font-bold text-gray-900">{receipt.amount.toFixed(2)} AED</td>
                                  <td className="py-3 px-3 text-center text-base text-gray-700">{receipt.source}</td>
                                  <td className="py-3 px-3 text-center text-base text-gray-600">{receipt.description}</td>
                                  <td className="py-3 px-3 text-center text-base">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${receipt.paid === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {receipt.paid}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : statsSubTab === 'expenses' ? (
                    <>
                      {filteredExpenses.length === 0 ? (
                        <p className="text-center text-gray-400 py-12">No expenses available</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b-2 border-gray-200">
                                <th className="text-center py-3 px-3 text-base font-bold text-gray-700">Date</th>
                                <th className="text-center py-3 px-3 text-base font-bold text-gray-700">Amount</th>
                                <th className="text-center py-3 px-3 text-base font-bold text-gray-700">Recipient</th>
                                <th className="text-center py-3 px-3 text-base font-bold text-gray-700">Description</th>
                                <th className="text-center py-3 px-3 text-base font-bold text-gray-700">Paid?</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredExpenses.slice().sort((a, b) => b.date.localeCompare(a.date)).map((expense, index) => (
                                <tr
                                  key={expense.id}
                                  onClick={() => openEditModal(expense, 'expense')}
                                  className={`border-b border-gray-100 hover:bg-red-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                >
                                  <td className="py-3 px-3 text-center text-base text-gray-600">{expense.date}</td>
                                  <td className="py-3 px-3 text-center text-base font-bold text-gray-900">{expense.amount.toFixed(2)} AED</td>
                                  <td className="py-3 px-3 text-center text-base text-gray-700">{expense.source}</td>
                                  <td className="py-3 px-3 text-center text-base text-gray-600">{expense.description}</td>
                                  <td className="py-3 px-3 text-center text-base">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${expense.paid === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {expense.paid}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {pendingPayments.length === 0 ? (
                        <div className="text-center py-16">
                          <div className="bg-gradient-to-br from-green-100 to-emerald-100 p-6 rounded-full inline-block mb-6 shadow-lg">
                            <TrendingUp className="w-12 h-12 text-green-600" />
                          </div>
                          <h3 className="text-2xl font-black text-gray-800 mb-2">All Payments Settled!</h3>
                          <p className="text-gray-500 text-lg">There are no pending payments at the moment.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Summary Card */}
                          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 shadow-xl text-white">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-amber-100 text-sm font-semibold uppercase tracking-wide mb-1">Total Outstanding</p>
                                <h2 className="text-4xl font-black">
                                  {pendingPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)} <span className="text-2xl">AED</span>
                                </h2>
                              </div>
                              <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                                <Wallet className="w-10 h-10" />
                              </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/20">
                              <p className="text-amber-100 text-sm">
                                <span className="font-bold text-white">{pendingPayments.length}</span> recipient{pendingPayments.length > 1 ? 's' : ''} with pending payments
                              </p>
                            </div>
                          </div>

                          {/* Recipients Cards */}
                          <div className="grid grid-cols-1 gap-3">
                            {pendingPayments.map((payment, index) => (
                              <div
                                key={index}
                                className="bg-white border-2 border-gray-100 rounded-xl p-5 hover:border-amber-400 hover:shadow-lg transition-all duration-300 group"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4 flex-1">
                                    <div className="bg-gradient-to-br from-amber-100 to-orange-100 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300">
                                      <div className="w-8 h-8 flex items-center justify-center">
                                        <span className="text-2xl font-black text-amber-600">#{index + 1}</span>
                                      </div>
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="text-lg font-bold text-gray-800 group-hover:text-amber-600 transition-colors">
                                        {payment.recipient}
                                      </h4>
                                      <p className="text-sm text-gray-500 mt-1">Pending Payment</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-3xl font-black text-red-600">
                                      {payment.amount.toFixed(2)} <span className="text-lg text-red-400">AED</span>
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}


          {/* Voucher Tab (Print Only) */}
          {activeTab === 'voucher' && (
            <div className="max-w-4xl mx-auto no-print">
              <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-cyan-100">
                <div className="flex items-center gap-4 mb-8 border-b pb-6">
                  <div className="bg-cyan-600 text-white p-3 rounded-xl">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Quick Print Voucher</h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block font-bold mb-2 text-sm text-gray-700">Payment Date</label>
                    <input
                      type="date"
                      value={voucherFormData.date}
                      onChange={(e) => setVoucherFormData({ ...voucherFormData, date: e.target.value })}
                      className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-cyan-600 focus:outline-none transition-all bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-2 text-sm text-gray-700">Amount (AED)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={voucherFormData.amount}
                      onChange={(e) => setVoucherFormData({ ...voucherFormData, amount: e.target.value })}
                      className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-cyan-600 focus:outline-none transition-all bg-gray-50 focus:bg-white text-cyan-600 font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-6 mb-10">
                  <div>
                    <label className="block font-bold mb-2 text-sm text-gray-700">Paid To (Recipient)</label>
                    <input
                      type="text"
                      value={voucherFormData.source}
                      onChange={(e) => setVoucherFormData({ ...voucherFormData, source: e.target.value })}
                      className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-cyan-600 focus:outline-none transition-all bg-gray-50 focus:bg-white font-bold"
                      placeholder="Enter name of person or company"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-2 text-sm text-gray-700">Description</label>
                    <textarea
                      value={voucherFormData.description}
                      onChange={(e) => setVoucherFormData({ ...voucherFormData, description: e.target.value })}
                      className="w-full border-2 border-gray-100 rounded-xl p-4 focus:border-cyan-600 focus:outline-none transition-all bg-gray-50 focus:bg-white resize-none"
                      rows={3}
                      placeholder="What is this payment for?"
                    />
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={handlePrintOnlyVoucher}
                    className="w-full md:w-1/2 bg-cyan-600 text-white font-black py-5 px-8 rounded-2xl hover:bg-cyan-700 transition-all duration-300 flex items-center justify-center gap-3 shadow-xl hover:shadow-cyan-100 hover:scale-[1.02] transform"
                  >
                    <FileText className="w-6 h-6" />
                    PRINT VOUCHER
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden container for global printing - MATCHING CASH RECEIPT LOGIC */}
      <div id="voucher-print" className="hidden-print m-0 p-0" style={{ width: '210mm' }}>
        <VoucherDocument data={voucherFormData} />
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
          .hidden-print { display: block !important; position: static !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          #voucher-print { border: none !important; box-shadow: none !important; width: 210mm !important; }
          @page { size: A4 portrait; margin: 0mm; }
        }
      `}</style>

      {/* Edit/Delete Modal */}
      {isModalOpen && selectedEntry && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">
                {entryType === 'receipt' ? 'Edit Receipt' : 'Edit Expense'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-semibold mb-2 text-sm text-gray-700">Date</label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2 text-sm text-gray-700">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2 text-sm text-gray-700">
                  {entryType === 'receipt' ? 'Source' : 'Recipient'}
                </label>
                <input
                  type="text"
                  value={editFormData.source}
                  onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                  placeholder={entryType === 'receipt' ? 'Source name' : 'Recipient name'}
                />
              </div>

              <div>
                <label className="block font-semibold mb-2 text-sm text-gray-700">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors resize-none"
                  rows={3}
                  placeholder="Description"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2 text-sm text-gray-700">Paid?</label>
                <select
                  value={editFormData.paid}
                  onChange={(e) => setEditFormData({ ...editFormData, paid: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUpdateEntry}
                  disabled={loading}
                  className="flex-1 bg-black text-white font-bold py-3 px-4 rounded-xl hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Update'}
                </button>
                <button
                  onClick={handleDeleteEntry}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={closeModal}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl hover:bg-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VoucherDocument({ data }: { data: any }) {
  return (

    <div className="bg-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="max-w-none w-full p-10 relative overflow-hidden">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
          <span className="text-9xl font-black rotate-[-45deg] whitespace-nowrap uppercase">PAID</span>
        </div>

        {/* Header */}
        <div className="text-center mb-10 border-b-2 border-black pb-8">
          <h1 className="text-2xl font-black uppercase tracking-widest text-gray-900 mb-2">Al Marai Al Arabia Trading Sole Proprietorship L.L.C</h1>
          <p className="text-lg font-bold text-gray-700 decoration-double underline underline-offset-4">PAYMENT VOUCHER</p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-10 mb-10">
          <div className="space-y-4">
            <div className="flex items-end gap-2 border-b border-gray-300 pb-1">
              <span className="font-bold text-sm uppercase text-gray-500 min-w-[100px]">Date:</span>
              <span className="text-lg font-bold">{data.date}</span>
            </div>
            <div className="flex items-end gap-2 border-b border-gray-300 pb-1">
              <span className="font-bold text-sm uppercase text-gray-500 min-w-[100px]">Amount:</span>
              <span className="text-lg font-bold italic underline">{(parseFloat(data.amount) || 0).toFixed(2)} AED</span>
            </div>
          </div>
          <div className="flex flex-col justify-center items-center bg-gray-50 p-6 rounded-lg border-2 border-black">
            <span className="text-xs font-black uppercase text-gray-500 mb-1">Total Amount</span>
            <span className="text-4xl font-black text-gray-900">{(parseFloat(data.amount) || 0).toFixed(2)} <span className="text-xl">AED</span></span>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 mb-10 mt-6">
          <div className="flex items-end gap-4 border-b-2 border-gray-200 pb-2">
            <span className="font-black text-sm uppercase text-gray-400 min-w-[120px]">Paid to:</span>
            <span className="text-2xl font-bold uppercase underline decoration-2 underline-offset-8 decoration-gray-400">{data.source}</span>
          </div>
          <div className="flex flex-col gap-4 border-b-2 border-gray-200 pb-2">
            <span className="font-black text-sm uppercase text-gray-400">Description:</span>
            <p className="text-2xl font-medium leading-relaxed italic pr-10">"{data.description}"</p>
          </div>
        </div>

        {/* Signature Section */}
        <div className="grid grid-cols-2 gap-24 pt-10">
          <div className="text-center border-t-2 border-black pt-4">
            <p className="text-xs font-black uppercase text-gray-500 mb-1">Authorized Signature</p>
            <div className="h-10"></div>
            <p className="font-bold text-gray-900 mt-2">_________________________</p>
          </div>
          <div className="text-center border-t-2 border-black pt-4">
            <p className="text-xs font-black uppercase text-gray-500 mb-1">Receiver's Signature</p>
            <div className="h-10"></div>
            <p className="font-bold text-gray-900 mt-2">_________________________</p>
          </div>
        </div>


      </div>
    </div>
  );
}

