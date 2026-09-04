'use client';

import { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Clock,
  FileText,
  Building,
  IdCard,
  Plane,
  Check,
  Calendar,
  ChevronRight,
  FileSignature,
} from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';

interface CustomerDoc {
  rowIndex: string;
  customerName: string;
  creditApp: string;
  creditAppDate: string;
  licence: string;
  licenceDate: string;
  trn: string;
  passport: string;
  id: string;
}

const DOC_FIELDS = [
  { field: 'creditApp' as const, label: 'Credit Application', short: 'Credit', icon: FileText, hasDate: true, dateField: 'creditAppDate' as const, dateLabel: 'Date' },
  { field: 'licence' as const, label: 'Trade Licence', short: 'Licence', icon: Building, hasDate: true, dateField: 'licenceDate' as const, dateLabel: 'Expiry Date' },
  { field: 'trn' as const, label: 'TRN Certificate', short: 'TRN', icon: ShieldCheck, hasDate: false },
  { field: 'passport' as const, label: 'Passport', short: 'Passport', icon: Plane, hasDate: false },
  { field: 'id' as const, label: 'ID Card', short: 'ID', icon: IdCard, hasDate: false },
];

const TOTAL_DOCS = DOC_FIELDS.length;

function getDocStatus(value: string) {
  if (!value) return 'missing';
  const val = value.toString().toLowerCase().trim();
  if (val === 'no' || val === '0' || val === 'false' || val === '') return 'missing';
  return 'complete';
}

function getDaysRemaining(dateStr: string) {
  if (!dateStr || dateStr.trim() === '') return null;
  const d = dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr;
  const expiryDate = new Date(d);
  if (isNaN(expiryDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getDaysPassed(dateStr: string) {
  if (!dateStr || dateStr.trim() === '') return null;
  const d = dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr;
  const startDate = new Date(d);
  if (isNaN(startDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function toInputDate(dateStr: string) {
  if (!dateStr) return '';
  if (dateStr.includes('/')) return dateStr.split('/').reverse().join('-');
  return dateStr;
}

function getCollectedCount(item: CustomerDoc) {
  return DOC_FIELDS.filter((doc) => getDocStatus(item[doc.field]) === 'complete').length;
}

function getHealthStatus(item: CustomerDoc) {
  const complete = getCollectedCount(item);
  const dates = [item.licenceDate];
  let expired = false;
  
  for (const d of dates) {
    const days = getDaysRemaining(d);
    if (days !== null && days <= 30) {
      expired = true;
    }
  }
  
  if (expired) return { label: 'Expired', color: 'bg-rose-500', ring: 'ring-rose-100', text: 'text-rose-600', icon: AlertTriangle };
  if (complete === TOTAL_DOCS) return { label: 'Complete', color: 'bg-emerald-500', ring: 'ring-emerald-100', text: 'text-emerald-600', icon: ShieldCheck };
  return { label: 'In Progress', color: 'bg-amber-500', ring: 'ring-amber-100', text: 'text-amber-600', icon: Clock };
}

export default function CustomersDocumentsGrid({
  data,
  loading,
  onUpdate,
}: {
  data: CustomerDoc[];
  loading: boolean;
  onUpdate: (rowIndex: string, field: keyof CustomerDoc, value: string) => void;
}) {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDoc | null>(null);

  const openCustomer = (item: CustomerDoc) => setSelectedCustomer(item);
  const closeModal = () => setSelectedCustomer(null);

  const handleFieldUpdate = (field: keyof CustomerDoc, value: string) => {
    if (!selectedCustomer) return;
    const updated = { ...selectedCustomer, [field]: value };
    setSelectedCustomer(updated);
    onUpdate(selectedCustomer.rowIndex, field, value);
  };

  if (data.length === 0 && !loading) {
    return <NoData title="No Customers Found" />;
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-24">
        {data.map((item) => {
          const collected = getCollectedCount(item);
          const health = getHealthStatus(item);
          const HealthIcon = health.icon;
          const progress = (collected / TOTAL_DOCS) * 100;

          return (
            <button
              key={item.rowIndex}
              type="button"
              onClick={() => openCustomer(item)}
              className="group text-left bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-0.5 hover:border-indigo-200 transition-all duration-300 relative overflow-hidden"
            >
              <div className={`absolute top-0 right-0 w-28 h-28 ${health.color} opacity-[0.05] rounded-bl-[4rem] -mr-6 -mt-6`} />

              <div className="flex items-start justify-between gap-3 mb-5 relative">
                <div className="min-w-0 flex-1">
                  <h3
                    className="font-black text-slate-800 text-base leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors"
                    title={item.customerName}
                  >
                    {item.customerName}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${health.color}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${health.text}`}>
                      {health.label}
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-2xl ${health.color} text-white shadow-lg shrink-0`}>
                  <HealthIcon className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-3 relative">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Collected</p>
                    <p className="text-2xl font-black text-slate-800 leading-none">
                      {collected}
                      <span className="text-sm font-bold text-slate-400"> / {TOTAL_DOCS}</span>
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                </div>

                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${health.color}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex gap-1 pt-1">
                  {DOC_FIELDS.map((doc) => {
                    const done = getDocStatus(item[doc.field]) === 'complete';
                    const DocIcon = doc.icon;
                    return (
                      <div
                        key={doc.field}
                        className={`flex-1 flex items-center justify-center py-2 rounded-xl ${
                          done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-300'
                        }`}
                        title={doc.short}
                      >
                        <DocIcon className="w-3.5 h-3.5" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCustomer && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">Customer Documents</p>
                <h3 className="text-xl font-black text-slate-900 leading-tight truncate" title={selectedCustomer.customerName}>
                  {selectedCustomer.customerName}
                </h3>
                <p className="text-sm font-bold text-slate-500 mt-1">
                  {getCollectedCount(selectedCustomer)} of {TOTAL_DOCS} documents collected
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-xl border border-slate-200 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-4">
              {DOC_FIELDS.map((doc) => {
                const DocIcon = doc.icon;
                const isComplete = getDocStatus(selectedCustomer[doc.field]) === 'complete';
                const dateField = doc.hasDate ? doc.dateField : null;
                const dateValue = dateField ? selectedCustomer[dateField] : '';
                const isStart = dateField === 'creditAppDate';
                const days = dateField ? (isStart ? getDaysPassed(dateValue) : getDaysRemaining(dateValue)) : null;

                return (
                  <div
                    key={doc.field}
                    className={`rounded-2xl border p-4 transition-all ${
                      isComplete ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2.5 rounded-xl ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                          <DocIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-800 text-sm">{doc.label}</p>
                          <p className={`text-[11px] font-bold uppercase tracking-wider ${isComplete ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {isComplete ? 'Collected' : 'Missing'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleFieldUpdate(doc.field, isComplete ? 'No' : 'Yes')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                          isComplete
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {isComplete ? <Check className="w-4 h-4" /> : null}
                        {isComplete ? 'Yes' : 'Mark Collected'}
                      </button>
                    </div>

                    {dateField && (
                      <div className="pl-[3.25rem] space-y-2">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <Calendar className="w-3.5 h-3.5" />
                          {doc.dateLabel || 'Expiry Date'}
                        </label>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <input
                            type="date"
                            value={toInputDate(dateValue)}
                            onChange={(e) => handleFieldUpdate(dateField, e.target.value)}
                            className={`flex-1 bg-white border rounded-xl px-4 py-2.5 text-sm font-bold outline-none transition-all ${
                              !isStart && days !== null && days < 0
                                ? 'border-rose-200 text-rose-700 bg-rose-50'
                                : 'border-slate-200 text-slate-700 hover:border-indigo-300 focus:border-indigo-500'
                            }`}
                          />
                          {days !== null && (
                            <span
                              className={`text-[11px] font-black px-3 py-2 rounded-xl text-center whitespace-nowrap ${
                                isStart
                                  ? 'bg-slate-50 text-slate-500 border border-slate-100'
                                  : days < 0
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}
                            >
                              {isStart ? `${days}d Active` : days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days} days left`}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
