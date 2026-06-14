'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, List, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Header from './Header';
import NewReceiptForm from './NewReceiptForm';
import SavedReceiptsTab from './SavedReceiptsTab';
import ReceiptDocument from './ReceiptDocument';
import { bhs_supabas } from '@/lib/Supabase';

function convertColorsToRgb(element: HTMLElement) {
  const properties = [
    'color',
    'backgroundColor',
    'borderColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'fill',
    'stroke'
  ];

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');

  function toRgb(colorStr: string) {
    if (!colorStr) return colorStr;
    const lower = colorStr.toLowerCase();
    if (
      lower.includes('lab(') ||
      lower.includes('oklch(') ||
      lower.includes('oklab(') ||
      lower.includes('lch(')
    ) {
      if (ctx) {
        try {
          ctx.fillStyle = colorStr;
          return ctx.fillStyle;
        } catch (e) {
          return colorStr;
        }
      }
    }
    return colorStr;
  }

  function processNode(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const computed = window.getComputedStyle(el);
      properties.forEach(prop => {
        const val = computed[prop as any];
        if (
          val &&
          (val.includes('lab(') ||
            val.includes('oklch(') ||
            val.includes('oklab(') ||
            val.includes('lch('))
        ) {
          el.style[prop as any] = toRgb(val);
        }
      });

      const bg = computed.background;
      if (
        bg &&
        (bg.includes('lab(') ||
          bg.includes('oklch(') ||
          bg.includes('oklab(') ||
          bg.includes('lch('))
      ) {
        const regex = /(?:oklch|oklab|lab|lch)\([^)]+\)/g;
        el.style.background = bg.replace(regex, (match) => toRgb(match));
      }

      const shadow = computed.boxShadow;
      if (
        shadow &&
        (shadow.includes('lab(') ||
          shadow.includes('oklch(') ||
          shadow.includes('oklab(') ||
          shadow.includes('lch('))
      ) {
        const regex = /(?:oklch|oklab|lab|lch)\([^)]+\)/g;
        el.style.boxShadow = shadow.replace(regex, (match) => toRgb(match));
      }
    }

    for (let i = 0; i < node.childNodes.length; i++) {
      processNode(node.childNodes[i]);
    }
  }

  processNode(element);
}

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
    } catch (error: any) {
      console.error('Error saving:', error);
      alert('Error: ' + error.message);
      return false;
    }
  };

  const handlePrint = async () => {
    if (!formData.receivedFrom || !formData.amount || !formData.receiptNumber) {
      alert('Please fill at least: Receipt Number, Received From, and Amount');
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

    const originalElement = document.getElementById('receipt-original');
    const copyElement = document.getElementById('receipt-copy');
    if (!originalElement || !copyElement) {
      setLoading(false);
      return;
    }

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;

      // Page 1: Original
      const canvas1 = await html2canvas(originalElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('receipt-original');
          if (el) convertColorsToRgb(el);
        }
      });
      const imgHeight1 = (canvas1.height * imgWidth) / canvas1.width;
      const imgData1 = canvas1.toDataURL('image/png');
      pdf.addImage(imgData1, 'PNG', 0, 0, imgWidth, imgHeight1);

      // Page 2: Copy
      pdf.addPage();
      const canvas2 = await html2canvas(copyElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('receipt-copy');
          if (el) convertColorsToRgb(el);
        }
      });
      const imgHeight2 = (canvas2.height * imgWidth) / canvas2.width;
      const imgData2 = canvas2.toDataURL('image/png');
      pdf.addImage(imgData2, 'PNG', 0, 0, imgWidth, imgHeight2);

      const cleanFilename = `${formData.receiptNumber}_${formData.date}`.replace(/[^a-z0-9]/gi, '_');
      pdf.save(`${cleanFilename}.pdf`);

      // If saved successfully, clear the form
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
        alert('Receipt saved and PDF generated successfully!');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
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
        if (data.nextId) {
          setFormData(prev => ({ ...prev, receiptNumber: data.nextId }));
          return data.nextId as string;
        }
      }
    } catch (error) {
      console.error('Error fetching next receipt number:', error);
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
    const originalFormData = { ...formData };
    setFormData({
      ...receipt,
      amount: (receipt.amount ?? 0).toString()
    });
    setTimeout(async () => {
      window.print();
      setFormData(originalFormData);
    }, 100);
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
        fetchSavedReceipts();
        setSelectedReceipt(null);
      } else {
        const errorData = await response.json();
        alert('Failed to delete: ' + errorData.error);
      }
    } catch (err) {
      console.error('Error deleting:', err);
      alert('An error occurred while deleting.');
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
          .hidden-print { position: absolute; left: -9999px; }
        }
        @media print {
          .no-print { display: none !important; }
          .hidden-print { display: block !important; position: static !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          #receipt { border: none !important; box-shadow: none !important; }
          @page { size: auto; margin: 0mm; }
        }
      `}</style>
    </>
  );
}
