'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { bhs_supabas, fetchAllData } from '@/lib/supabase';
import {
  FileX2,
  Plus,
  Printer,
  Download,
  Loader2,
  XCircle,
  Search,
  StickyNote,
} from 'lucide-react';
import SearchSelect from '../Components/DropDownList';
import TabLoader from '@/app/Components/TabLoader';
import { toast } from '@/app/Components/Notification';
import {
  generateCancelInvoicePDF,
  CancelInvoicePdfRow,
} from '@/app/LPOs/Pdf/CancelInvoicePdf';

function getCurrentUserName(): string {
  if (typeof window === 'undefined') return '';
  try {
    const stored = localStorage.getItem('currentUser');
    if (!stored) return '';
    const user = JSON.parse(stored);
    return String(user.NAME || user.name || '').trim();
  } catch {
    return '';
  }
}

interface CancelFormEntry {
  tempId: string;
  invoiceId: string;
  customerName: string;
  amount: number;
  orderDate?: string;
}

interface OrderSuggestion {
  ORDER_ID: string;
  INVOICE_ID: string;
  AMOUNT: string | number;
  ORDER_DATE?: string;
  CREATED_AT?: string;
  CUSTOMER_ID?: string;
  bhs_CUSTOMERS?: { 'CUSTOMER NAME'?: string };
}

export default function InvoiceCancelPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<CancelFormEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [formCustomerId, setFormCustomerId] = useState('');
  const [formInvoiceId, setFormInvoiceId] = useState('');
  const [formAmount, setFormAmount] = useState('');

  const [invoiceSuggestions, setInvoiceSuggestions] = useState<OrderSuggestion[]>([]);
  const [isSearchingInvoices, setIsSearchingInvoices] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const invoiceSearchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (invoiceSearchRef.current && !invoiceSearchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchInitialData() {
    try {
      const customerRows = await fetchAllData(() =>
        bhs_supabas
          .from('bhs_CUSTOMERS')
          .select('*, "CUSTOMER NAME":"CUSTOMER SUB NAME"')
          .order('CUSTOMER SUB NAME'),
      );
      setCustomers(customerRows);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const customerOptions = customers.map((c) => ({
    id: c['CUSTOMER ID'],
    label: c['CUSTOMER NAME'] || c['CUSTOMER SUB NAME'] || '-',
  }));

  const getCustomerName = (customerId: string) => {
    const match = customers.find((c) => c['CUSTOMER ID'] === customerId);
    return match?.['CUSTOMER NAME'] || match?.['CUSTOMER SUB NAME'] || '';
  };

  const searchInvoices = useCallback(
    async (query: string, customerId: string) => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setInvoiceSuggestions([]);
        return;
      }

      setIsSearchingInvoices(true);
      try {
        let request = bhs_supabas
          .from('app_lpos_ORDERS')
          .select(`
            ORDER_ID,
            INVOICE_ID,
            AMOUNT,
            ORDER_DATE,
            CREATED_AT,
            CUSTOMER_ID,
            bhs_CUSTOMERS ( "CUSTOMER NAME":"CUSTOMER SUB NAME" )
          `)
          .ilike('INVOICE_ID', `%${trimmed}%`)
          .order('ORDER_DATE', { ascending: false })
          .limit(15);

        if (customerId) {
          request = request.eq('CUSTOMER_ID', customerId);
        }

        const { data, error } = await request;
        if (error) throw error;
        setInvoiceSuggestions((data as OrderSuggestion[]) || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Invoice search failed:', err);
        setInvoiceSuggestions([]);
      } finally {
        setIsSearchingInvoices(false);
      }
    },
    [],
  );

  const handleInvoiceInputChange = (value: string) => {
    setFormInvoiceId(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchInvoices(value, formCustomerId);
    }, 300);
  };

  const applySuggestion = (order: OrderSuggestion) => {
    setFormInvoiceId(order.INVOICE_ID || '');
    setFormAmount(String(parseFloat(String(order.AMOUNT)) || ''));
    if (order.CUSTOMER_ID) {
      setFormCustomerId(order.CUSTOMER_ID);
    }
    setShowSuggestions(false);
    setInvoiceSuggestions([]);
  };

  const resetForm = () => {
    setFormCustomerId('');
    setFormInvoiceId('');
    setFormAmount('');
    setInvoiceSuggestions([]);
    setShowSuggestions(false);
  };

  const addEntry = () => {
    const invoiceId = formInvoiceId.trim();
    const customerName = getCustomerName(formCustomerId);
    const amount = parseFloat(formAmount);

    if (!customerName) {
      toast.error('Please select a customer.');
      return;
    }
    if (!invoiceId) {
      toast.error('Please enter an invoice number.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }
    if (entries.some((e) => e.invoiceId.toLowerCase() === invoiceId.toLowerCase())) {
      toast.error('This invoice is already in the list.');
      return;
    }

    setEntries((prev) => [
      ...prev,
      {
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        invoiceId,
        customerName,
        amount,
      },
    ]);
    resetForm();
  };

  const removeEntry = (tempId: string) => {
    setEntries((prev) => prev.filter((e) => e.tempId !== tempId));
  };

  const buildPdfRows = (): CancelInvoicePdfRow[] =>
    entries.map((e) => ({
      invoiceId: e.invoiceId,
      customerName: e.customerName,
      amount: e.amount,
      orderDate: e.orderDate,
    }));

  const handleCancelFormPdf = async (action: 'download' | 'print') => {
    const rows = buildPdfRows();
    if (rows.length === 0) {
      toast.error('Add at least one invoice to the cancellation form.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      await generateCancelInvoicePDF({
        invoices: rows,
        cancelDate: new Date().toISOString(),
        notes: notes.trim() || undefined,
        printedBy: getCurrentUserName() || undefined,
        action,
      });
    } catch (err) {
      console.error('Error generating cancel form PDF:', err);
      toast.error('Failed to generate cancellation form.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

  if (isLoading) {
    return <TabLoader className="min-h-[400px]" />;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-4xl font-normal text-black tracking-tighter flex items-center gap-3">
          <FileX2 className="w-9 h-9 text-red-500" />
          Invoice Cancel
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleCancelFormPdf('print')}
            disabled={isGeneratingPdf || entries.length === 0}
            title="Print Form"
            className="p-3 bg-black text-[#D4AF37] rounded-2xl hover:bg-gray-900 transition-all flex items-center justify-center disabled:opacity-50"
          >
            {isGeneratingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => handleCancelFormPdf('download')}
            disabled={isGeneratingPdf || entries.length === 0}
            title="Download PDF"
            className="p-3 bg-white border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center disabled:opacity-50"
          >
            {isGeneratingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-gray-100">
        <h2 className="text-lg font-black text-black mb-6">Add Invoice</h2>
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_0.8fr_auto] gap-4 items-end">
          <div className="min-w-0">
            <SearchSelect
              label="Customer"
              options={customerOptions}
              value={formCustomerId}
              onChange={(val) => {
                setFormCustomerId(val);
                if (formInvoiceId.trim().length >= 2) {
                  searchInvoices(formInvoiceId, val);
                }
              }}
              placeholder="Search customer..."
              isLoading={isLoading}
            />
          </div>

          <div className="min-w-0 relative" ref={invoiceSearchRef}>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2 mb-2 block">
              Invoice No.
            </label>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formInvoiceId}
                onChange={(e) => handleInvoiceInputChange(e.target.value)}
                onFocus={() => {
                  if (invoiceSuggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="Search or type invoice no."
                className="w-full pl-12 pr-6 h-[68px] bg-white border-2 border-gray-50 rounded-[1.5rem] focus:outline-none focus:border-black/10 focus:ring-4 focus:ring-black/5 transition-all text-sm font-black text-black placeholder:text-gray-300 placeholder:font-bold"
              />
              {isSearchingInvoices && (
                <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>

            {showSuggestions && invoiceSuggestions.length > 0 && (
              <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-gray-100 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.12)] z-[200] overflow-hidden max-h-[280px] overflow-y-auto">
                {invoiceSuggestions.map((order) => {
                  const name =
                    order.bhs_CUSTOMERS?.['CUSTOMER NAME'] ||
                    getCustomerName(order.CUSTOMER_ID || '') ||
                    'Unknown';
                  return (
                    <button
                      key={order.ORDER_ID}
                      type="button"
                      onClick={() => applySuggestion(order)}
                      className="w-full text-left px-5 py-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <div className="font-black text-sm text-black">{order.INVOICE_ID || '-'}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                        {name} · AED {parseFloat(String(order.AMOUNT)).toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2 mb-2 block">
              Amount (AED)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-6 h-[68px] bg-amber-50/30 border border-[#D4AF37]/20 rounded-[1.5rem] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/10 focus:bg-white focus:border-[#D4AF37] transition-all text-sm font-black text-black"
            />
          </div>

          <button
            type="button"
            onClick={addEntry}
            className="w-[68px] h-[68px] bg-[#D4AF37] text-black rounded-2xl font-black shadow-lg shadow-[#D4AF37]/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
            title="Add invoice"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 px-2">
            <h3 className="text-2xl font-black text-black">
              Invoices to Cancel ({entries.length})
            </h3>
            <div className="text-sm font-black text-red-600">
              Total: AED {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[2.5rem] border border-gray-50">
            <table className="w-full text-center">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">#</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Invoice No.</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Amount</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry, index) => (
                  <tr key={entry.tempId} className="hover:bg-gray-50/50 transition-all">
                    <td className="px-6 py-5 font-bold text-gray-500 text-sm">{index + 1}</td>
                    <td className="px-6 py-5 font-black text-black text-sm">{entry.invoiceId}</td>
                    <td className="px-6 py-5 font-bold text-gray-700 text-sm">{entry.customerName}</td>
                    <td className="px-6 py-5 font-black text-black text-sm">
                      {entry.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                    </td>
                    <td className="px-6 py-5">
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.tempId)}
                        className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white hover:scale-110 transition-all shadow-sm mx-auto"
                        title="Remove"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] p-16 shadow-sm border border-gray-100 text-center">
          <FileX2 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-sm font-black text-gray-400 uppercase tracking-widest">
            No invoices added yet
          </p>
          <p className="text-xs text-gray-400 mt-2 font-medium">
            Search for a customer and invoice, or type the details manually, then click Add.
          </p>
        </div>
      )}

      <div className="bg-white rounded-[3rem] p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <StickyNote className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-black text-black">Notes</h2>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Optional notes to appear on the cancellation form..."
          className="w-full px-6 py-4 bg-gray-50/50 border-2 border-gray-50 rounded-[1.5rem] focus:outline-none focus:border-black/10 focus:bg-white transition-all text-sm font-medium text-black placeholder:text-gray-300 resize-y min-h-[100px]"
        />
      </div>
    </div>
  );
}
