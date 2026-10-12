'use client';

// ════════════════════════════════════════════════════════════════
//  LPO order details — one tab, three sections:
//    1. Order Details  (view / edit — save & cancel come from the page header)
//    2. Driver
//    3. Invoice Status (current status only, office: Accept or Cancel)
// ════════════════════════════════════════════════════════════════

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { bhs_supabas, fetchAllData } from '@/lib/secureDb';
import { listLpoUsers, findLpoUserByName } from '../../Service/lpo_users_service';
import SearchSelect from '../../Components/DropDownList';
import { toast } from '@/app/Components/Notification';
import { ConfirmModal } from '../../Components/ConfirmModal';
import { generateCancelInvoicePDF } from '@/app/LPOs/Pdf/CancelInvoicePdf';
import {
  User,
  Calendar,
  Banknote,
  Copy,
  Check,
  Truck,
  Trash2,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Printer,
  Download,
  Info,
  Lock,
} from 'lucide-react';

export type OrderDetailsTabHandle = {
  save: (notes?: string) => Promise<void>;
  cancel: () => void;
};

interface OrderDetailsTabProps {
  order: any;
  /** order approved -> driver & invoice sections are active */
  isApproved: boolean;
  canEdit: boolean;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
  onOrderUpdated: () => void;
  onActionStateChange?: (state: { isSaving: boolean; isLoadingOptions: boolean }) => void;
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
type OrderFormData = {
  CUSTOMER_ID: string;
  INVOICE_ID: string;
  LPO_ID: string;
  ORDER_DATE: string;
  AMOUNT: string;
};

function ToDateInputValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function BuildFormData(order: any): OrderFormData {
  return {
    CUSTOMER_ID: order.CUSTOMER_ID || '',
    INVOICE_ID: order.INVOICE_ID || '',
    LPO_ID: order.LPO_ID || '',
    ORDER_DATE: ToDateInputValue(order.ORDER_DATE || order.CREATED_AT),
    AMOUNT: order.AMOUNT != null ? String(order.AMOUNT) : '',
  };
}

function FormatDateTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-GB')} - ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

/** New driver -> the invoice workflow starts again for him. */
function BuildDriverWorkflowReset(newDriverId: string | null) {
  return {
    DRIVERS_NAME: newDriverId,
    DISPATCH_TIME: newDriverId ? new Date().toISOString() : null,
    DELIVERY_TIME: null,
    STATUS: newDriverId ? 'Dispatched' : 'Assigned',
    OFFICE_HANDOVER_ID: null,
    OFFICE_HANDOVER_STATUS: null,
    OFFICE_HANDOVER_TIME: null,
    TRACKING_NOTES: null,
  };
}

const CARD = 'bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-black transition-all duration-300';
const INPUT = 'w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 text-black font-bold';

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center text-[#D4AF37]">{icon}</div>
      <h3 className="text-xl font-black text-black tracking-tight">{title}</h3>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────
const OrderDetailsTab = forwardRef<OrderDetailsTabHandle, OrderDetailsTabProps>(function OrderDetailsTab(
  { order, isApproved, canEdit, isEditing, onEditingChange, onOrderUpdated, onActionStateChange },
  ref
) {
  // ── 1. order details (edit) ──
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [formData, setFormData] = useState<OrderFormData>(() => BuildFormData(order));

  // ── 2 & 3. driver record + staff ──
  const [delivery, setDelivery] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingDelivery, setIsLoadingDelivery] = useState(true);
  const [isSavingDriver, setIsSavingDriver] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [pendingAction, setPendingAction] = useState<'accept' | 'cancel' | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    setFormData(BuildFormData(order));
  }, [order]);

  // customers list only while editing
  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      setIsLoadingOptions(true);
      try {
        const rows = await fetchAllData(() =>
          bhs_supabas.from('bhs_CUSTOMERS').select('*, "CUSTOMER NAME":"CUSTOMER SUB NAME"').order('CUSTOMER SUB NAME')
        );
        setCustomers(rows);
      } catch (err) {
        console.error('Error loading customers:', err);
        toast.error('Failed to load customers');
      } finally {
        setIsLoadingOptions(false);
      }
    })();
  }, [isEditing]);

  const loadDelivery = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoadingDelivery(true);
      try {
        const { data, error } = await bhs_supabas
          .from('app_lpos_DRIVERS')
          .select('*')
          .eq('ORDER_ID', order.ORDER_ID)
          .maybeSingle();
        if (error) throw error;
        setDelivery(data || null);
      } catch (err) {
        console.error('Error loading driver data:', err);
      } finally {
        if (!silent) setIsLoadingDelivery(false);
      }
    },
    [order.ORDER_ID]
  );

  useEffect(() => {
    void loadDelivery();
    // keep the status fresh while the page is open (the driver works from the app)
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void loadDelivery(true);
    }, 20000);
    return () => clearInterval(timer);
  }, [loadDelivery]);

  // staff list + the logged-in user's profile (for Accept / Cancel rights)
  useEffect(() => {
    (async () => {
      try {
        const users = await listLpoUsers();
        setStaff(users);
        const saved = JSON.parse(localStorage.getItem('currentUser') || 'null');
        const name = String(saved?.name || saved?.NAME || '').trim();
        if (name) {
          const me =
            users.find((u: any) => String(u.NAME || '').trim().toLowerCase() === name.toLowerCase()) ||
            (await findLpoUserByName(name));
          setCurrentUser(me || { ID: saved?.id || saved?.ID, NAME: name, ROLE: saved?.userAdmin || '' });
        }
      } catch (err) {
        console.error('Error loading staff:', err);
      }
    })();
  }, []);

  // ── order details: save / cancel (called from the page header) ──
  const handleCancel = () => {
    setFormData(BuildFormData(order));
    onEditingChange(false);
  };

  const handleSave = async (notes?: string) => {
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

    setIsSavingInfo(true);
    try {
      const updateData: any = {
        CUSTOMER_ID: formData.CUSTOMER_ID,
        INVOICE_ID: trimmedInvoice || null,
        LPO_ID: trimmedLpo || null,
        ORDER_DATE: formData.ORDER_DATE ? new Date(formData.ORDER_DATE).toISOString() : order.ORDER_DATE || order.CREATED_AT,
        AMOUNT: amount,
      };
      if (notes !== undefined) updateData.NOTES = notes;

      const { error } = await bhs_supabas.from('app_lpos_ORDERS').update(updateData).eq('ID', order.ID);
      if (error) throw error;
      toast.success('Order details updated successfully');
      onEditingChange(false);
      onOrderUpdated();
    } catch (err: any) {
      console.error('Error updating order info:', err);
      toast.error(err.message || 'Failed to update order details');
    } finally {
      setIsSavingInfo(false);
    }
  };

  useEffect(() => {
    onActionStateChange?.({ isSaving: isSavingInfo, isLoadingOptions });
  }, [isSavingInfo, isLoadingOptions, onActionStateChange]);

  useImperativeHandle(ref, () => ({ save: handleSave, cancel: handleCancel }), [handleSave, handleCancel]);

  // ── driver ──
  const nextDriverRecordId = async () => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await bhs_supabas.from('app_lpos_DRIVERS').select('ID').order('ID').range(from, from + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const max = rows.reduce((m: number, r: any) => {
      const n = String(r.ID || '').match(/(\d+)\s*$/);
      return n ? Math.max(m, parseInt(n[1], 10)) : m;
    }, 0);
    return `R-${(max + 1).toString().padStart(4, '0')}`;
  };

  const saveDriverFields = async (fields: Record<string, any>) => {
    setIsSavingDriver(true);
    try {
      if (!delivery?.ID) {
        const { data, error } = await bhs_supabas
          .from('app_lpos_DRIVERS')
          .insert([{ ID: await nextDriverRecordId(), ORDER_ID: order.ORDER_ID, STATUS: 'Assigned', ...fields }])
          .select()
          .maybeSingle();
        if (error) throw error;
        setDelivery(data);
      } else {
        const { data, error } = await bhs_supabas
          .from('app_lpos_DRIVERS')
          .update(fields)
          .eq('ID', delivery.ID)
          .select()
          .maybeSingle();
        if (error) throw error;
        setDelivery(data || { ...delivery, ...fields });
      }
    } catch (err: any) {
      console.error('Error saving driver:', err);
      toast.error(err.message || 'Failed to save driver');
    } finally {
      setIsSavingDriver(false);
    }
  };

  const staffOptions = useMemo(() => staff.map((s) => ({ id: s.ID, label: s.NAME })), [staff]);
  const staffName = (id?: string | null) => (id ? staff.find((s) => s.ID === id)?.NAME || id : '');

  // ── invoice status ──
  const notes = String(delivery?.TRACKING_NOTES || '');
  const handover = delivery?.OFFICE_HANDOVER_STATUS || null;
  const isCancelled = notes === 'SYSTEM_CANCELLED';

  const status: { label: string; detail: string; tone: 'gray' | 'amber' | 'green' | 'red' } = (() => {
    if (!delivery?.DRIVERS_NAME) return { label: 'No Driver', detail: 'Assign a driver first.', tone: 'gray' };
    if (handover === 'Confirmed' && isCancelled)
      return { label: 'Cancelled', detail: `Cancelled by ${staffName(delivery.OFFICE_HANDOVER_ID) || 'the office'} on ${FormatDateTime(delivery.OFFICE_HANDOVER_TIME)}`, tone: 'red' };
    if (handover === 'Confirmed')
      return { label: 'Received', detail: `Received by ${staffName(delivery.OFFICE_HANDOVER_ID) || 'the office'} on ${FormatDateTime(delivery.OFFICE_HANDOVER_TIME)}`, tone: 'green' };
    if (handover === 'Pending' && isCancelled)
      return { label: 'Cancel Requested', detail: `The driver asked to cancel this invoice (${FormatDateTime(delivery.OFFICE_HANDOVER_TIME)}).`, tone: 'amber' };
    if (handover === 'Pending')
      return { label: 'Waiting Office', detail: `The driver handed the stamped invoice to ${staffName(delivery.OFFICE_HANDOVER_ID) || 'the office'} (${FormatDateTime(delivery.OFFICE_HANDOVER_TIME)}).`, tone: 'amber' };
    return { label: 'With Driver', detail: 'The invoice is not handed to the office yet.', tone: 'gray' };
  })();

  const isFinal = handover === 'Confirmed';
  const roleText = String(currentUser?.ROLE || '').toLowerCase();
  const isAdmin = roleText === 'admin' || String(currentUser?.NAME || '').trim().toLowerCase() === 'med sabry';
  const hasCancelAuthority = isAdmin || currentUser?.CANCEL_AUTHORITY === true || String(currentUser?.CANCEL_AUTHORITY).toUpperCase() === 'TRUE';
  // a stamped invoice handed to someone -> only he (or an admin) accepts it
  const handedToOther = handover === 'Pending' && !isCancelled && delivery?.OFFICE_HANDOVER_ID && delivery.OFFICE_HANDOVER_ID !== currentUser?.ID;
  const canAccept = canEdit && !!delivery?.DRIVERS_NAME && !isFinal && (!handedToOther || isAdmin);
  const canCancel = canEdit && !!delivery?.DRIVERS_NAME && !isFinal && hasCancelAuthority;

  const applyAction = async (action: 'accept' | 'cancel') => {
    if (!delivery?.ID) return;
    setIsSavingStatus(true);
    try {
      const now = new Date().toISOString();
      const userId = currentUser?.ID || 'R-0001';
      const payload =
        action === 'accept'
          ? {
              STATUS: 'Delivered',
              DELIVERY_TIME: delivery.DELIVERY_TIME || now,
              OFFICE_HANDOVER_ID: userId,
              OFFICE_HANDOVER_STATUS: 'Confirmed',
              OFFICE_HANDOVER_TIME: now,
              // driver handed it -> normal receipt; nothing from the driver -> received directly by the office
              TRACKING_NOTES: handover === 'Pending' && !isCancelled ? null : 'DIRECT_OFFICE_RECEIPT',
            }
          : {
              STATUS: 'Delivered',
              DELIVERY_TIME: delivery.DELIVERY_TIME || now,
              OFFICE_HANDOVER_ID: userId,
              OFFICE_HANDOVER_STATUS: 'Confirmed',
              OFFICE_HANDOVER_TIME: now,
              TRACKING_NOTES: 'SYSTEM_CANCELLED',
            };
      const { error } = await bhs_supabas.from('app_lpos_DRIVERS').update(payload).eq('ID', delivery.ID);
      if (error) throw error;
      toast.success(action === 'accept' ? 'Invoice received' : 'Invoice cancelled');
      await loadDelivery(true);
    } catch (err: any) {
      console.error('Error updating invoice status:', err);
      toast.error(err.message || 'Failed to update invoice status');
    } finally {
      setIsSavingStatus(false);
      setPendingAction(null);
    }
  };

  const handleCancelFormPdf = async (action: 'download' | 'print') => {
    setIsGeneratingPdf(true);
    try {
      await generateCancelInvoicePDF({
        invoices: [
          {
            invoiceId: order.INVOICE_ID || order.ORDER_ID,
            customerName: order.bhs_CUSTOMERS?.['CUSTOMER NAME'] || order.CUSTOMER_NAME || 'Unknown Customer',
            amount: parseFloat(order.AMOUNT ?? order.TOTAL_AMOUNT) || 0,
            orderDate: order.ORDER_DATE || order.CREATED_AT,
          },
        ],
        cancelDate: delivery?.OFFICE_HANDOVER_TIME || new Date().toISOString(),
        printedBy: currentUser?.NAME || undefined,
        action,
      });
    } catch (err) {
      console.error('Error generating cancel form PDF:', err);
      toast.error('Failed to generate the cancellation form');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const selectedCustomerName = isEditing
    ? customers.find((c) => c['CUSTOMER ID'] === formData.CUSTOMER_ID)?.['CUSTOMER NAME'] || 'None'
    : order.bhs_CUSTOMERS?.['CUSTOMER NAME'] || 'None';

  const toneClass = {
    gray: 'bg-gray-100 text-gray-500',
    amber: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20',
    green: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
    red: 'bg-red-500 text-white shadow-lg shadow-red-500/20',
  }[status.tone];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ═══ 1. ORDER DETAILS ═══ */}
      <section className="space-y-5">
        <SectionTitle icon={<Info className="w-5 h-5" />} title="Order Details" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div className={CARD}>
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
            <h4 className="text-xl font-black text-black tracking-tight">{order.ORDER_ID}</h4>
          </div>

          <div className={CARD}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Order Date</span>
              <Calendar className="w-4 h-4 text-gray-400" />
            </div>
            {isEditing ? (
              <input
                type="date"
                value={formData.ORDER_DATE}
                onChange={(e) => setFormData((p) => ({ ...p, ORDER_DATE: e.target.value }))}
                className={INPUT}
              />
            ) : (
              <h4 className="text-lg font-black text-black">
                {new Date(order.ORDER_DATE || order.CREATED_AT).toLocaleDateString('en-GB')}
              </h4>
            )}
          </div>

          <div className={`${CARD} md:col-span-2`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Customer</span>
              <User className="w-4 h-4 text-gray-400" />
            </div>
            {isEditing ? (
              <SearchSelect
                label=""
                options={customers.map((c) => ({ id: c['CUSTOMER ID'], label: c['CUSTOMER NAME'] || c['CUSTOMER SUB NAME'] || c['CUSTOMER ID'] }))}
                value={formData.CUSTOMER_ID}
                onChange={(value) => setFormData((p) => ({ ...p, CUSTOMER_ID: value }))}
                placeholder="Select customer..."
                isLoading={isLoadingOptions}
                heightClass="h-[56px]"
              />
            ) : (
              <h4 className="text-xl font-black text-black truncate">{selectedCustomerName}</h4>
            )}
          </div>

          <div className={CARD}>
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
                onChange={(e) => setFormData((p) => ({ ...p, INVOICE_ID: e.target.value }))}
                placeholder="Invoice ID"
                className={INPUT}
              />
            ) : (
              <h4 className="text-xl font-black text-black tracking-tight">{order.INVOICE_ID || 'Not Available'}</h4>
            )}
          </div>

          <div className={CARD}>
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
                onChange={(e) => setFormData((p) => ({ ...p, LPO_ID: e.target.value }))}
                placeholder="LPO ID"
                className={INPUT}
              />
            ) : (
              <h4 className="text-xl font-black text-black tracking-tight">{order.LPO_ID || 'Not Available'}</h4>
            )}
          </div>

          <div className={CARD}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Amount</span>
              <Banknote className="w-4 h-4 text-[#D4AF37]" />
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.AMOUNT}
                  onChange={(e) => setFormData((p) => ({ ...p, AMOUNT: e.target.value }))}
                  placeholder="0.00"
                  className={INPUT}
                />
                <span className="text-xs text-gray-500 font-bold shrink-0">AED</span>
              </div>
            ) : (
              <h4 className="text-xl font-black text-black">
                <span className="text-[#D4AF37]">
                  {order.AMOUNT
                    ? Number(order.AMOUNT).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '0.00'}
                </span>{' '}
                <span className="text-xs text-gray-500 font-bold">AED</span>
              </h4>
            )}
          </div>

          <div className={CARD}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Created At</span>
              <Calendar className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-lg font-black text-black">{new Date(order.CREATED_AT).toLocaleString('en-GB')}</h4>
          </div>
        </div>
      </section>

      {/* ═══ 2. DRIVER ═══ */}
      <section className="space-y-5">
        <SectionTitle icon={<Truck className="w-5 h-5" />} title="Driver" />
        {!isApproved ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 text-sm font-bold text-gray-400">
            The order is not approved yet.
          </div>
        ) : isLoadingDelivery ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 flex items-center gap-3 text-gray-400 text-sm font-bold">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading driver...
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-3 md:max-w-xl">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Driver</span>
            {delivery?.DRIVERS_NAME ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-black text-[#D4AF37] rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                    {staffName(delivery.DRIVERS_NAME).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-black truncate">{staffName(delivery.DRIVERS_NAME)}</p>
                    {delivery.DISPATCH_TIME && (
                      <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> Assigned {FormatDateTime(delivery.DISPATCH_TIME)}
                      </p>
                    )}
                  </div>
                </div>
                {canEdit && !isFinal && (
                  <button
                    onClick={() => saveDriverFields(BuildDriverWorkflowReset(null))}
                    disabled={isSavingDriver}
                    title="Remove driver"
                    className="w-10 h-10 bg-white border border-red-50 text-red-400 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : canEdit ? (
              <SearchSelect
                label=""
                placeholder="Select driver..."
                options={staffOptions}
                value=""
                onChange={(val) => saveDriverFields(BuildDriverWorkflowReset(val || null))}
              />
            ) : (
              <p className="text-sm font-bold text-gray-400">Not assigned</p>
            )}
          </div>
        )}
      </section>

      {/* ═══ 3. INVOICE STATUS ═══ */}
      <section className="space-y-5">
        <SectionTitle icon={<FileText className="w-5 h-5" />} title="Invoice Status" />
        {!isApproved ? (
          <div className="bg-white rounded-3xl p-6 border border-gray-100 text-sm font-bold text-gray-400">
            The order is not approved yet.
          </div>
        ) : isLoadingDelivery ? null : (
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-5 min-w-0">
              <span className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap ${toneClass}`}>
                {status.label}
              </span>
              <p className="text-sm font-bold text-gray-600">{status.detail}</p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {isFinal && isCancelled && (
                <>
                  <button
                    onClick={() => handleCancelFormPdf('print')}
                    disabled={isGeneratingPdf}
                    title="Print Cancellation Form"
                    className="p-3 bg-black text-[#D4AF37] rounded-2xl hover:bg-gray-900 transition-all disabled:opacity-50"
                  >
                    {isGeneratingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleCancelFormPdf('download')}
                    disabled={isGeneratingPdf}
                    title="Download Cancellation Form"
                    className="p-3 bg-white border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    {isGeneratingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  </button>
                </>
              )}

              {!isFinal && delivery?.DRIVERS_NAME && (canAccept || canCancel) && (
                <>
                  <button
                    onClick={() => setPendingAction('cancel')}
                    disabled={isSavingStatus || !canCancel}
                    title={canCancel ? 'Cancel the invoice' : 'Needs Cancel Authority'}
                    className="px-8 py-4 bg-white border border-red-100 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-50 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSavingStatus ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                    Cancel
                  </button>
                  <button
                    onClick={() => setPendingAction('accept')}
                    disabled={isSavingStatus || !canAccept}
                    title={canAccept ? 'Receive the invoice' : 'Only the person it was handed to can accept it'}
                    className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSavingStatus ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Accept
                  </button>
                </>
              )}

              {!isFinal && delivery?.DRIVERS_NAME && !canAccept && !canCancel && canEdit && (
                <span className="flex items-center gap-2 text-xs font-bold text-gray-400">
                  <Lock className="w-4 h-4" /> Waiting for {staffName(delivery.OFFICE_HANDOVER_ID) || 'the office'}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={pendingAction !== null}
        onConfirm={() => pendingAction && applyAction(pendingAction)}
        onCancel={() => setPendingAction(null)}
        isLoading={isSavingStatus}
        title={pendingAction === 'cancel' ? 'Cancel Invoice' : 'Accept Invoice'}
        message={
          pendingAction === 'cancel'
            ? 'Are you sure you want to cancel this invoice?'
            : 'Confirm that the office received this invoice?'
        }
      />
    </div>
  );
});

export default OrderDetailsTab;
