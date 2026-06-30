'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { bhs_supabas } from '@/lib/supabase';
import SearchSelect from '../../Components/DropDownList';
import { toast } from '@/app/Components/Notification';
import {
  User,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Banknote,
  Copy,
  Check,
} from 'lucide-react';

export type OrderInfoTabHandle = {
  save: () => Promise<void>;
  cancel: () => void;
};

interface OrderInfoTabProps {
  order: any;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
  onOrderUpdated: () => void;
  onActionStateChange?: (state: { isSaving: boolean; isLoadingOptions: boolean }) => void;
}

type OrderFormData = {
  CUSTOMER_ID: string;
  CREATED_BY: string;
  INVOICE_ID: string;
  LPO_ID: string;
  ORDER_DATE: string;
  AMOUNT: string;
};

function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function buildFormData(order: any): OrderFormData {
  return {
    CUSTOMER_ID: order.CUSTOMER_ID || '',
    CREATED_BY: order.CREATED_BY || '',
    INVOICE_ID: order.INVOICE_ID || '',
    LPO_ID: order.LPO_ID || '',
    ORDER_DATE: toDateInputValue(order.ORDER_DATE || order.CREATED_AT),
    AMOUNT: order.AMOUNT != null ? String(order.AMOUNT) : '',
  };
}

const OrderInfoTab = forwardRef<OrderInfoTabHandle, OrderInfoTabProps>(function OrderInfoTab(
  { order, isEditing, onEditingChange, onOrderUpdated, onActionStateChange },
  ref
) {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [formData, setFormData] = useState<OrderFormData>(() => buildFormData(order));

  useEffect(() => {
    setFormData(buildFormData(order));
  }, [order]);

  useEffect(() => {
    if (!isEditing) return;

    const fetchOptions = async () => {
      setIsLoadingOptions(true);
      try {
        const [usersRes, customersRes] = await Promise.all([
          bhs_supabas.from('bhs_USERS').select('*').order('NAME'),
          bhs_supabas
            .from('bhs_CUSTOMERS')
            .select('*, "CUSTOMER NAME":"CUSTOMER SUB NAME"')
            .order('CUSTOMER SUB NAME'),
        ]);
        setUsers(usersRes.data || []);
        setCustomers(customersRes.data || []);
      } catch (err) {
        console.error('Error loading order info options:', err);
        toast.error('Failed to load customers and users');
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [isEditing]);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        id: c['CUSTOMER ID'],
        label: c['CUSTOMER NAME'] || c['CUSTOMER SUB NAME'] || c['CUSTOMER ID'],
      })),
    [customers]
  );

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        id: u.ID,
        label: u.NAME,
      })),
    [users]
  );

  const selectedCustomerName = useMemo(() => {
    if (isEditing) {
      return customers.find((c) => c['CUSTOMER ID'] === formData.CUSTOMER_ID)?.['CUSTOMER NAME'] || 'None';
    }
    return order.bhs_CUSTOMERS?.['CUSTOMER NAME'] || 'None';
  }, [isEditing, formData.CUSTOMER_ID, customers, order]);

  const selectedSalesRepName = useMemo(() => {
    if (isEditing) {
      return users.find((u) => u.ID === formData.CREATED_BY)?.NAME || 'None';
    }
    return order.bhs_USERS?.NAME || 'None';
  }, [isEditing, formData.CREATED_BY, users, order]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCancel = () => {
    setFormData(buildFormData(order));
    onEditingChange(false);
  };

  const handleSave = async () => {
    if (!formData.CUSTOMER_ID) {
      toast.error('Please select a customer');
      return;
    }

    const amount = parseFloat(formData.AMOUNT);
    if (!formData.AMOUNT || Number.isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid order amount');
      return;
    }

    const trimmedInvoice = formData.INVOICE_ID.trim();
    const trimmedLpo = formData.LPO_ID.trim();
    if (!trimmedInvoice && !trimmedLpo) {
      toast.error('Please enter either LPO ID or Invoice ID');
      return;
    }

    if (trimmedInvoice) {
      const { data } = await bhs_supabas
        .from('app_lpos_ORDERS')
        .select('ORDER_ID')
        .eq('INVOICE_ID', trimmedInvoice)
        .neq('ID', order.ID)
        .limit(1);

      if (data && data.length > 0) {
        toast.error(`Invoice ID "${trimmedInvoice}" already exists in Order ${data[0].ORDER_ID}`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const orderDateVal = formData.ORDER_DATE
        ? new Date(formData.ORDER_DATE).toISOString()
        : order.ORDER_DATE || order.CREATED_AT;

      const { error } = await bhs_supabas
        .from('app_lpos_ORDERS')
        .update({
          CUSTOMER_ID: formData.CUSTOMER_ID,
          CREATED_BY: formData.CREATED_BY || null,
          INVOICE_ID: trimmedInvoice || null,
          LPO_ID: trimmedLpo || null,
          ORDER_DATE: orderDateVal,
          AMOUNT: amount,
        })
        .eq('ID', order.ID);

      if (error) throw error;

      toast.success('Order details updated successfully');
      onEditingChange(false);
      onOrderUpdated();
    } catch (err: any) {
      console.error('Error updating order info:', err);
      toast.error(err.message || 'Failed to update order details');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black font-bold';

  useEffect(() => {
    onActionStateChange?.({ isSaving, isLoadingOptions });
  }, [isSaving, isLoadingOptions, onActionStateChange]);

  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: handleCancel,
  }), [handleSave, handleCancel]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Customer</span>
            <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
          {isEditing ? (
            <SearchSelect
              label=""
              options={customerOptions}
              value={formData.CUSTOMER_ID}
              onChange={(value) => setFormData((prev) => ({ ...prev, CUSTOMER_ID: value }))}
              placeholder="Select customer..."
              isLoading={isLoadingOptions}
              heightClass="h-[56px]"
            />
          ) : (
            <div>
              <h4 className="text-xl font-black text-black truncate">{selectedCustomerName}</h4>
              <p className="text-xs font-semibold text-gray-400 mt-1">Customer account name</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Order Status</span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                order.STATUS === 'Approved'
                  ? 'bg-emerald-50 text-emerald-600'
                  : order.STATUS === 'Partially Approved'
                    ? 'bg-teal-50 text-teal-600'
                    : order.STATUS === 'Rejected'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-amber-50 text-amber-600'
              }`}
            >
              {order.STATUS === 'Approved' && <CheckCircle2 className="w-4 h-4" />}
              {order.STATUS === 'Partially Approved' && <CheckCircle2 className="w-4 h-4" />}
              {order.STATUS === 'Rejected' && <XCircle className="w-4 h-4" />}
              {order.STATUS === 'Pending' && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </div>
          <div>
            <h4
              className={`text-xl font-black ${
                order.STATUS === 'Approved'
                  ? 'text-emerald-600'
                  : order.STATUS === 'Partially Approved'
                    ? 'text-teal-600'
                    : order.STATUS === 'Rejected'
                      ? 'text-red-600'
                      : 'text-amber-500'
              }`}
            >
              {order.STATUS}
            </h4>
            <p className="text-xs font-semibold text-gray-400 mt-1">Current processing stage</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Order ID</span>
            <button
              onClick={() => handleCopy(order.ORDER_ID, 'order_id')}
              className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 hover:text-black transition-all"
              title="Copy ID"
            >
              {copiedField === 'order_id' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div>
            <h4 className="text-xl font-black text-black tracking-tight">{order.ORDER_ID}</h4>
            <p className="text-xs font-semibold text-gray-400 mt-1">System reference ID</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Invoice ID</span>
            {!isEditing && order.INVOICE_ID && (
              <button
                onClick={() => handleCopy(order.INVOICE_ID, 'invoice_id')}
                className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 hover:text-black transition-all"
                title="Copy Invoice ID"
              >
                {copiedField === 'invoice_id' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
          {isEditing ? (
            <input
              type="text"
              value={formData.INVOICE_ID}
              onChange={(e) => setFormData((prev) => ({ ...prev, INVOICE_ID: e.target.value }))}
              placeholder="Invoice ID"
              className={inputClass}
            />
          ) : (
            <div>
              <h4 className="text-xl font-black text-black tracking-tight">{order.INVOICE_ID || 'Not Available'}</h4>
              <p className="text-xs font-semibold text-gray-400 mt-1">Invoice tracking code</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">LPO ID</span>
            {!isEditing && order.LPO_ID && (
              <button
                onClick={() => handleCopy(order.LPO_ID, 'lpo_id')}
                className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 hover:text-black transition-all"
                title="Copy LPO ID"
              >
                {copiedField === 'lpo_id' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
          {isEditing ? (
            <input
              type="text"
              value={formData.LPO_ID}
              onChange={(e) => setFormData((prev) => ({ ...prev, LPO_ID: e.target.value }))}
              placeholder="LPO ID"
              className={inputClass}
            />
          ) : (
            <div>
              <h4 className="text-xl font-black text-black tracking-tight">{order.LPO_ID || 'Not Available'}</h4>
              <p className="text-xs font-semibold text-gray-400 mt-1">Local Purchase Order ID</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Created At</span>
            <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h4 className="text-lg font-black text-black">{new Date(order.CREATED_AT).toLocaleString('en-GB')}</h4>
            <p className="text-xs font-semibold text-gray-400 mt-1">System registration timestamp</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Order Date</span>
            <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          {isEditing ? (
            <input
              type="date"
              value={formData.ORDER_DATE}
              onChange={(e) => setFormData((prev) => ({ ...prev, ORDER_DATE: e.target.value }))}
              className={inputClass}
            />
          ) : (
            <div>
              <h4 className="text-lg font-black text-black">
                {order.ORDER_DATE
                  ? new Date(order.ORDER_DATE).toLocaleDateString('en-GB')
                  : new Date(order.CREATED_AT).toLocaleDateString('en-GB')}
              </h4>
              <p className="text-xs font-semibold text-gray-400 mt-1">Requested delivery/order date</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Amount</span>
            <div className="w-8 h-8 rounded-xl bg-gray-50 text-[#D4AF37] flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.AMOUNT}
                onChange={(e) => setFormData((prev) => ({ ...prev, AMOUNT: e.target.value }))}
                placeholder="0.00"
                className={inputClass}
              />
              <span className="text-xs text-gray-500 font-bold shrink-0">AED</span>
            </div>
          ) : (
            <div>
              <h4 className="text-xl font-black text-black">
                <span className="text-[#D4AF37]">
                  {order.AMOUNT
                    ? order.AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '0.00'}
                </span>{' '}
                <span className="text-xs text-gray-500 font-bold">AED</span>
              </h4>
              <p className="text-xs font-semibold text-gray-400 mt-1">Calculated order value</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Sales Rep</span>
            <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
          {isEditing ? (
            <SearchSelect
              label=""
              options={userOptions}
              value={formData.CREATED_BY}
              onChange={(value) => setFormData((prev) => ({ ...prev, CREATED_BY: value }))}
              placeholder="Select sales rep..."
              isLoading={isLoadingOptions}
              heightClass="h-[56px]"
            />
          ) : (
            <div>
              <h4 className="text-lg font-black text-black truncate">{selectedSalesRepName}</h4>
              <p className="text-xs font-semibold text-gray-400 mt-1">Responsible account manager</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default OrderInfoTab;
