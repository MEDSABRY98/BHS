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
  rowIndex?: number;
}

interface Expense {
  id: number;
  amount: number;
  source: string;
  description: string;
  date: string;
  rowIndex?: number;
}

export default function PettyCashTab() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<'receipts' | 'expenses' | 'stats'>('receipts');
  const [statsSubTab, setStatsSubTab] = useState<'receipts' | 'expenses'>('receipts');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Receipt | Expense | null>(null);
  const [entryType, setEntryType] = useState<'receipt' | 'expense'>('receipt');
  const [editFormData, setEditFormData] = useState({
    date: '',
    amount: '',
    source: '',
    description: ''
  });
  const [receiptFormData, setReceiptFormData] = useState({
    amount: '',
    source: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [expenseFormData, setExpenseFormData] = useState({
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
            date: new Date().toISOString().split('T')[0]
          });
        } else {
          setExpenseFormData({
            amount: '',
            source: '',
            description: '',
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
      description: entry.description
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
      description: ''
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
  }, [receipts, searchQuery, fromDate, toDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Date filter
      if (fromDate && expense.date < fromDate) return false;
      if (toDate && expense.date > toDate) return false;
      
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
  }, [expenses, searchQuery, fromDate, toDate]);

  const exportToExcel = () => {
    // Prepare Receipts data (use filtered data)
    const receiptsData = filteredReceipts.slice().reverse().map(receipt => ({
      'Date': receipt.date,
      'Amount': receipt.amount,
      'Source': receipt.source,
      'Description': receipt.description
    }));

    // Prepare Expenses data (use filtered data)
    const expensesData = filteredExpenses.slice().reverse().map(expense => ({
      'Date': expense.date,
      'Amount': expense.amount,
      'Recipient': expense.source,
      'Description': expense.description
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
    { id: 'stats' as const, name: 'Statistics', icon: BarChart3 }
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} bg-white text-gray-900 transition-all duration-300 overflow-hidden shadow-2xl border-r border-gray-200`}>
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
                  className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all duration-200 ${
                    activeTab === tab.id 
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
      <div className="flex-1 overflow-auto">
        {/* Top Bar */}
        <div className="bg-white shadow-md p-5 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Date</label>
                          <input
                            type="date"
                            value={receiptFormData.date}
                            onChange={(e) => setReceiptFormData({...receiptFormData, date: e.target.value})}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                          />
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            value={receiptFormData.amount}
                            onChange={(e) => setReceiptFormData({...receiptFormData, amount: e.target.value})}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                            placeholder="0.00"
                          />
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Source</label>
                          <input
                            type="text"
                            value={receiptFormData.source}
                            onChange={(e) => setReceiptFormData({...receiptFormData, source: e.target.value})}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                            placeholder="Source name"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block font-semibold mb-2 text-sm text-gray-700">Description</label>
                        <textarea
                          value={receiptFormData.description}
                          onChange={(e) => setReceiptFormData({...receiptFormData, description: e.target.value})}
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

                {/* List Card */}
                <div>
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Receipt Records ({receipts.length})
                    </h3>
                    
                    {receipts.length === 0 ? (
                      <div className="text-center py-16">
                        <TrendingUp className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg">No receipts recorded</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                        {receipts.slice().reverse().map(receipt => (
                          <div key={receipt.id} className="border-2 border-gray-200 rounded-xl p-4 hover:border-black hover:shadow-md transition-all duration-200">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-2xl font-bold text-gray-900">{receipt.amount.toFixed(2)} AED</span>
                                  <span className="text-xs bg-gray-100 px-3 py-1 rounded-full text-gray-600">{receipt.date}</span>
                                </div>
                                <p className="text-sm mb-1 text-gray-700"><span className="font-bold">Source:</span> {receipt.source}</p>
                                <p className="text-sm text-gray-600">{receipt.description}</p>
                              </div>
                              <button
                                onClick={() => deleteEntry(receipt.id, 'receipt')}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Date</label>
                          <input
                            type="date"
                            value={expenseFormData.date}
                            onChange={(e) => setExpenseFormData({...expenseFormData, date: e.target.value})}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                          />
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            value={expenseFormData.amount}
                            onChange={(e) => setExpenseFormData({...expenseFormData, amount: e.target.value})}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                            placeholder="0.00"
                          />
                        </div>
                        
                        <div>
                          <label className="block font-semibold mb-2 text-sm text-gray-700">Recipient</label>
                          <input
                            type="text"
                            value={expenseFormData.source}
                            onChange={(e) => setExpenseFormData({...expenseFormData, source: e.target.value})}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                            placeholder="Recipient name"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block font-semibold mb-2 text-sm text-gray-700">Description</label>
                        <textarea
                          value={expenseFormData.description}
                          onChange={(e) => setExpenseFormData({...expenseFormData, description: e.target.value})}
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

                {/* List Card */}
                <div>
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Expense Records ({expenses.length})
                    </h3>
                    
                    {expenses.length === 0 ? (
                      <div className="text-center py-16">
                        <TrendingDown className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg">No expenses recorded</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                        {expenses.slice().reverse().map(expense => (
                          <div key={expense.id} className="border-2 border-gray-200 rounded-xl p-4 hover:border-black hover:shadow-md transition-all duration-200">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-2xl font-bold text-gray-900">{expense.amount.toFixed(2)} AED</span>
                                  <span className="text-xs bg-gray-100 px-3 py-1 rounded-full text-gray-600">{expense.date}</span>
                                </div>
                                <p className="text-sm mb-1 text-gray-700"><span className="font-bold">Recipient:</span> {expense.source}</p>
                                <p className="text-sm text-gray-600">{expense.description}</p>
                              </div>
                              <button
                                onClick={() => deleteEntry(expense.id, 'expense')}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                      statsSubTab === 'receipts'
                        ? 'bg-green-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Receipts Tracking
                  </button>
                  <button
                    onClick={() => setStatsSubTab('expenses')}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                      statsSubTab === 'expenses'
                        ? 'bg-red-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Expenses Tracking
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
                            </tr>
                          </thead>
                          <tbody>
                            {filteredReceipts.slice().reverse().map((receipt, index) => (
                              <tr 
                                key={receipt.id} 
                                onClick={() => openEditModal(receipt, 'receipt')}
                                className={`border-b border-gray-100 hover:bg-green-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                              >
                                <td className="py-3 px-3 text-center text-base text-gray-600">{receipt.date}</td>
                                <td className="py-3 px-3 text-center text-base font-bold text-gray-900">{receipt.amount.toFixed(2)} AED</td>
                                <td className="py-3 px-3 text-center text-base text-gray-700">{receipt.source}</td>
                                <td className="py-3 px-3 text-center text-base text-gray-600">{receipt.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
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
                            </tr>
                          </thead>
                          <tbody>
                            {filteredExpenses.slice().reverse().map((expense, index) => (
                              <tr 
                                key={expense.id} 
                                onClick={() => openEditModal(expense, 'expense')}
                                className={`border-b border-gray-100 hover:bg-red-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                              >
                                <td className="py-3 px-3 text-center text-base text-gray-600">{expense.date}</td>
                                <td className="py-3 px-3 text-center text-base font-bold text-gray-900">{expense.amount.toFixed(2)} AED</td>
                                <td className="py-3 px-3 text-center text-base text-gray-700">{expense.source}</td>
                                <td className="py-3 px-3 text-center text-base text-gray-600">{expense.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
                  onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2 text-sm text-gray-700">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
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
                  onChange={(e) => setEditFormData({...editFormData, source: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors"
                  placeholder={entryType === 'receipt' ? 'Source name' : 'Recipient name'}
                />
              </div>

              <div>
                <label className="block font-semibold mb-2 text-sm text-gray-700">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-black focus:outline-none transition-colors resize-none"
                  rows={3}
                  placeholder="Description"
                />
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

