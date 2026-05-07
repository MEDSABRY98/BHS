'use client';

import { useState, useMemo } from 'react';
import { 
  Check, 
  X, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  Clock,
  User,
  FileText,
  Building,
  IdCard,
  Plane
} from 'lucide-react';
import NoData from '../01-Unified/NoDataTab';

interface CustomerDoc {
  rowIndex: number;
  customerName: string;
  creditApp: string;
  licence: string;
  licenceDate: string;
  trn: string;
  passport: string;
  passportDate: string;
  id: string;
  idDate: string;
}

export default function CustomersDocumentsGrid({ 
  data, 
  loading,
  onUpdate 
}: { 
  data: CustomerDoc[]; 
  loading: boolean;
  onUpdate: (rowIndex: number, field: keyof CustomerDoc, value: string) => void;
}) {
  const getDocStatus = (value: string) => {
    if (!value) return 'missing';
    const val = value.toString().toLowerCase().trim();
    if (val === 'no' || val === '0' || val === 'false' || val === '') return 'missing';
    return 'complete';
  };

  const getDaysRemaining = (dateStr: string) => {
    if (!dateStr) return null;
    let d = dateStr;
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      d = `${year}-${month}-${day}`;
    }
    const expiryDate = new Date(d);
    if (isNaN(expiryDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getHealthStatus = (item: CustomerDoc) => {
    const docs = [item.creditApp, item.licence, item.trn, item.passport, item.id];
    const complete = docs.filter(d => getDocStatus(d) === 'complete').length;
    const dates = [item.licenceDate, item.passportDate, item.idDate];
    const expired = dates.some(d => {
      const days = getDaysRemaining(d);
      return days !== null && days < 0;
    });

    if (expired) return { label: 'Expired Documents', color: 'bg-rose-500', icon: AlertTriangle };
    if (complete === docs.length) return { label: 'Fully Documented', color: 'bg-emerald-500', icon: ShieldCheck };
    return { label: `${complete}/${docs.length} Documents`, color: 'bg-amber-500', icon: Clock };
  };

  if (data.length === 0 && !loading) {
    return <NoData title="No Customers Found" message="Try searching for a different name or sync your Google Sheet." />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-24">
      {data.map((item) => {
        const health = getHealthStatus(item);
        const HealthIcon = health.icon;

        return (
          <div key={item.rowIndex} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden">
            {/* Decorative Background */}
            <div className={`absolute top-0 right-0 w-40 h-40 ${health.color} opacity-[0.04] rounded-bl-[6rem] -mr-10 -mt-10 transition-all group-hover:scale-125`} />

            {/* Card Header */}
            <div className="flex items-start justify-between mb-8 relative">
              <div className="space-y-2 max-w-[75%]">
                <h3 className="font-black text-slate-800 text-xl leading-tight truncate tracking-tight" title={item.customerName}>
                  {item.customerName}
                </h3>
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${health.color}`} />
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{health.label}</span>
                </div>
              </div>
              <div className={`p-4 rounded-[1.5rem] ${health.color} text-white shadow-2xl shadow-slate-200 group-hover:rotate-6 transition-transform`}>
                <HealthIcon className="w-6 h-6" />
              </div>
            </div>

            {/* Checklist Grid */}
            <div className="bg-slate-50/50 rounded-[2rem] p-2 grid grid-cols-5 gap-1.5 mb-8 border border-slate-100/50">
              {[
                { field: 'creditApp', label: 'Credit', icon: FileText },
                { field: 'licence', label: 'Lic.', icon: Building },
                { field: 'trn', label: 'TRN', icon: ShieldCheck },
                { field: 'passport', label: 'Pass', icon: Plane },
                { field: 'id', label: 'ID', icon: IdCard }
              ].map((doc) => {
                const status = getDocStatus(item[doc.field as keyof CustomerDoc] as string);
                const DocIcon = doc.icon;
                return (
                  <button
                    key={doc.field}
                    onClick={() => onUpdate(item.rowIndex, doc.field as keyof CustomerDoc, status === 'complete' ? 'No' : 'Yes')}
                    className={`flex flex-col items-center gap-3 py-4 px-1 rounded-2xl transition-all ${
                      status === 'complete' 
                      ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100 scale-105 z-10' 
                      : 'text-slate-300 hover:text-slate-400'
                    }`}
                  >
                    <DocIcon className="w-6 h-6" />
                    <span className="text-[11px] font-black uppercase tracking-widest">{doc.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Expiration Timeline - Now in a single row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { field: 'licenceDate', label: 'Trade Licence', icon: Building },
                { field: 'passportDate', label: 'Passport', icon: Plane },
                { field: 'idDate', label: 'ID Card', icon: IdCard }
              ].map((expiry) => {
                const days = getDaysRemaining(item[expiry.field as keyof CustomerDoc] as string);
                const ExIcon = expiry.icon;
                return (
                  <div key={expiry.field} className="group/item flex flex-col gap-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <ExIcon className="w-3.5 h-3.5 text-slate-400 group-hover/item:text-indigo-500" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter truncate">{expiry.label}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <input
                        type="date"
                        value={item[expiry.field as keyof CustomerDoc] ? (item[expiry.field as keyof CustomerDoc] as string).includes('/') ? (item[expiry.field as keyof CustomerDoc] as string).split('/').reverse().join('-') : item[expiry.field as keyof CustomerDoc] as string : ''}
                        onChange={(e) => onUpdate(item.rowIndex, expiry.field as keyof CustomerDoc, e.target.value)}
                        className={`w-full bg-slate-50/50 border border-slate-100 rounded-xl px-3 py-2.5 text-sm font-black outline-none transition-all cursor-pointer ${days !== null && days < 0 ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-slate-700 hover:border-indigo-200'}`}
                      />
                      {days !== null && (
                        <div className={`text-[11px] font-black px-2 py-1 rounded-lg text-center shadow-sm ${days < 0 ? 'bg-rose-500 text-white' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                          {days < 0 ? 'EXPIRED' : `${days} DAYS LEFT`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
