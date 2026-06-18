'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, List, AlertTriangle } from 'lucide-react';
import Header from './Header';
import { generateReceiptPdf } from '../Utils/ReceiptPdf';
import NewReceiptForm from './NewReceiptForm';
import SavedReceiptsTab from './SavedReceiptsTab';
import ReceiptDocument from './ReceiptDocument';
import { bhs_supabas } from '@/lib/supabase';
import { toast } from '@/app/Components/Notification';

interface CashReceiptTabProps {
  activeTab: 'new' | 'saved';
  setActiveTab: (tab: 'new' | 'saved') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function CashReceiptTab({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery
}: CashReceiptTabProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [medSabrySignature, setMedSabrySignature] = useState<string>('');

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) { }
    }
  }, []);

  useEffect(() => {
    async function fetchMedSabrySignature() {
      try {
        const { data, error } = await bhs_supabas
          .from('bhs_USERS')
          .select('SIGNATURE')
          .eq('NAME', 'MED Sabry')
          .maybeSingle();

        if (data && data.SIGNATURE) {
          setMedSabrySignature(data.SIGNATURE);
        }
      } catch (err) {
        console.error('Error fetching signature:', err);
      }
    }
    fetchMedSabrySignature();
  }, []);

  const [formData, setFormData] = useState({
    receivedFrom: '',
    sendBy: '',
    amount: '',
    amountInWords: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
    receiptNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [savedReceipts, setSavedReceipts] = useState<any[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [isFetchingSaved, setIsFetchingSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<any>(null);

  useEffect(() => {
    setSelectedReceipt(null);
    if (activeTab === 'new' && !isEditing) {
      fetchNextReceiptNumber();
    }
  }, [activeTab]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const numberToWords = (num: number): string => {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';

    const convert = (n: number): string => {
      if (n < 10) return units[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
      if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
      if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
      return '';
    };

    const wholePart = Math.floor(num);
    const decimalPart = Math.round((num - wholePart) * 100);

    let result = convert(wholePart) + ' UAE Dirhams';
    if (decimalPart > 0) {
      result += ' and ' + convert(decimalPart) + ' Fils';
    }
    return result + ' Only';
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const num = parseFloat(val);
    setFormData(prev => ({
      ...prev,
      amount: val,
      amountInWords: !isNaN(num) ? numberToWords(num) : ''
    }));
  };

  const saveToDatabase = async () => {
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const response = await fetch('/api/CashReceipt', {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: formData.date,
          receiptNumber: formData.receiptNumber,
          receivedFrom: formData.receivedFrom,
          sendBy: formData.sendBy,
          amount: formData.amount,
          amountInWords: formData.amountInWords,
          reason: formData.reason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save to database');
      }
      return true;
    } catch (error: unknown) {
      console.error('Error saving:', error);
      const message = error instanceof Error ? error.message : 'Failed to save receipt';
      toast.error(message);
      return false;
    }
  };

  const handlePrint = async () => {
    if (!formData.receivedFrom || !formData.amount || !formData.receiptNumber) {
      toast.warning('Please fill at least: Receipt Number, Received From, and Amount');
      return;
    }

    setLoading(true);

    const saved = await saveToDatabase();
    if (!saved) {
      if (!confirm('Failed to save to Database. This receipt number might already exist or there was a connection error. Do you want to continue printing anyway without saving?')) {
        setLoading(false);
        return;
      }
    }

    try {
      const cleanFilename = `${formData.receiptNumber}_${formData.date}`.replace(/[^a-z0-9]/gi, '_');
      await generateReceiptPdf({
        data: {
          receiptNumber: formData.receiptNumber,
          date: formData.date,
          receivedFrom: formData.receivedFrom,
          sendBy: formData.sendBy,
          amount: formData.amount,
          amountInWords: formData.amountInWords,
          reason: formData.reason,
          receivedBySignature: medSabrySignature,
        },
        filename: cleanFilename,
      });

      // If saved successfully, clear the form
      const wasEditing = isEditing;

      if (saved) {
        setIsEditing(false);
        const nextId = await fetchNextReceiptNumber();
        setFormData({
          receivedFrom: '',
          sendBy: '',
          amount: '',
          amountInWords: '',
          reason: '',
          date: new Date().toISOString().split('T')[0],
          receiptNumber: nextId || ''
        });
      }

      toast.success(
        !saved
          ? 'PDF generated successfully!'
          : wasEditing
            ? 'Receipt updated and PDF generated successfully!'
            : 'Receipt saved and PDF generated successfully!'
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to generate PDF: ${message}`);
      window.print();
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    window.location.href = '/';
  };

  useEffect(() => {
    const handleBeforePrint = () => {
      const receiptNumber = formData.receiptNumber || 'Receipt';
      const date = formData.date || new Date().toISOString().split('T')[0];
      const filename = `${receiptNumber}_${date}`;
      document.title = filename;
    };

    const handleAfterPrint = () => {
      document.title = 'BHS Analysis';
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [formData.receiptNumber, formData.date]);

  const fetchNextReceiptNumber = async () => {
    try {
      const response = await fetch('/api/CashReceipt?t=' + Date.now());
      if (response.ok) {
        const data = await response.json();
        const nextNumber = data.nextReceiptNumber || data.nextId;
        if (nextNumber) {
          setFormData(prev => ({ ...prev, receiptNumber: nextNumber }));
          return nextNumber as string;
        }
      }
    } catch (error) {
      console.error('Error fetching next receipt number:', error);
      toast.error('Failed to load next receipt number');
    }
    return '';
  };

  const fetchSavedReceipts = async () => {
    setIsFetchingSaved(true);
    try {
      const response = await fetch('/api/CashReceipt?all=true&t=' + Date.now());
      if (response.ok) {
        const data = await response.json();
        setSavedReceipts(data.receipts || []);
      }
    } catch (error) {
      console.error('Error fetching saved receipts:', error);
      toast.error('Failed to load saved receipts');
    } finally {
      setIsFetchingSaved(false);
    }
  };

  useEffect(() => {
    fetchNextReceiptNumber();
  }, []);

  useEffect(() => {
    if (activeTab === 'saved') {
      fetchSavedReceipts();
    }
  }, [activeTab]);

  const filteredReceipts = [...savedReceipts]
    .filter(r =>
      r.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.receivedFrom.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => b.receiptNumber.localeCompare(a.receiptNumber));

  const availableTabs = [
    { id: 'new', label: 'New Receipt', icon: PlusCircle },
    { id: 'saved', label: 'Saved Receipts', icon: List }
  ].filter(tab => {
    try {
      const perms = JSON.parse(currentUser?.role || '{}');
      if (perms['cash-receipt'] && currentUser?.name !== 'MED Sabry') {
        return perms['cash-receipt'].includes(tab.id);
      }
    } catch (e) { }
    return true;
  });

  const handleReprint = async (receipt: any) => {
    try {
      const cleanFilename = `${receipt.receiptNumber}_${receipt.date}`.replace(/[^a-z0-9]/gi, '_');
      await generateReceiptPdf({
        data: {
          receiptNumber: receipt.receiptNumber,
          date: receipt.date,
          receivedFrom: receipt.receivedFrom,
          sendBy: receipt.sendBy || '',
          amount: receipt.amount ?? 0,
          amountInWords: receipt.amountInWords || '',
          reason: receipt.reason || '',
          receivedBySignature: medSabrySignature,
        },
        filename: cleanFilename,
      });
      toast.success('Receipt PDF downloaded successfully');
    } catch (error) {
      console.error('Error reprinting receipt:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to reprint receipt: ${message}`);
    }
  };

  const handleEdit = (receipt: any) => {
    setFormData({
      date: receipt.date,
      receiptNumber: receipt.receiptNumber,
      receivedFrom: receipt.receivedFrom,
      sendBy: receipt.sendBy,
      amount: receipt.amount?.toString() || '',
      amountInWords: receipt.amountInWords,
      reason: receipt.reason
    });
    setIsEditing(true);
    setActiveTab('new');
  };

  const handleDelete = (receipt: any) => {
    setReceiptToDelete(receipt);
  };

  const confirmDelete = async () => {
    if (!receiptToDelete) return;
    
    try {
      const response = await fetch(`/api/CashReceipt?receiptNumber=${receiptToDelete.receiptNumber}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        toast.success('Receipt deleted successfully');
        fetchSavedReceipts();
        setSelectedReceipt(null);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete receipt');
      }
    } catch (err) {
      console.error('Error deleting:', err);
      toast.error('An error occurred while deleting the receipt');
    } finally {
      setReceiptToDelete(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    fetchNextReceiptNumber().then(nextId => {
      setFormData({
        receivedFrom: '',
        sendBy: '',
        amount: '',
        amountInWords: '',
        reason: '',
        date: new Date().toISOString().split('T')[0],
        receiptNumber: nextId || ''
      });
    });
  };

  return (
    <>
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 no-print custom-scrollbar">
        <div className="max-w-7xl mx-auto pb-20">
          {activeTab === 'new' && (
            <NewReceiptForm
              formData={formData}
              handleChange={handleChange}
              handleAmountChange={handleAmountChange}
              loading={loading}
              onPrint={handlePrint}
              isEditing={isEditing}
              onCancel={handleCancelEdit}
            />
          )}

          {activeTab === 'saved' && (
            <SavedReceiptsTab
              isFetchingSaved={isFetchingSaved}
              filteredReceipts={filteredReceipts}
              selectedReceipt={selectedReceipt}
              setSelectedReceipt={setSelectedReceipt}
              onReprint={handleReprint}
              onEdit={handleEdit}
              onDelete={handleDelete}
              searchQuery={searchQuery}
              receivedBySignature={medSabrySignature}
            />
          )}
        </div>
      </div>

      {/* Hidden container for global printing */}
      <div className="hidden-print m-0 p-0" style={{ width: '210mm', fontFamily: 'system-ui, sans-serif' }}>
        <div id="receipt-original">
          <ReceiptDocument data={formData} isCopy={false} receivedBySignature={medSabrySignature} />
        </div>
        <div id="receipt-copy">
          <ReceiptDocument data={formData} isCopy={true} receivedBySignature={medSabrySignature} />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {receiptToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Delete Receipt?</h3>
              <p className="text-gray-500 font-medium mb-8">
                Are you sure you want to delete receipt <span className="text-gray-900 font-bold">{receiptToDelete.receiptNumber}</span>? This action cannot be undone.
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setReceiptToDelete(null)}
                  className="flex-1 py-3.5 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3.5 px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/20 transition-all"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
        
        @media screen {
          .hidden-print {
            display: none !important;
          }
        }
        @media print {
          .no-print { display: none !important; }
          .hidden-print {
            display: block !important;
            position: static !important;
            opacity: 1 !important;
            visibility: visible !important;
          }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          #receipt { border: none !important; box-shadow: none !important; }
          @page { size: auto; margin: 0mm; }
        }
      `}</style>
    </>
  );
}
