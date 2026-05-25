'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Check, 
  X, 
  Loader2,
  User
} from 'lucide-react';
import Loading from '../01-Unified/Loading';
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

export default function CustomersDocumentsTab({ 
  initialData = [],
  loading = false,
  refreshTrigger = 0 
}: { 
  initialData?: CustomerDoc[];
  loading?: boolean;
  refreshTrigger?: number; 
}) {
  const [data, setData] = useState<CustomerDoc[]>(initialData);
  const [updatingRow, setUpdatingRow] = useState<number | null>(null);

  // Sync with initialData when it changes
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const handleUpdate = async (rowIndex: number, field: keyof CustomerDoc, value: string) => {
    setUpdatingRow(rowIndex);
    try {
      // Update local state first
      const newData = data.map(item => 
        item.rowIndex === rowIndex ? { ...item, [field]: value } : item
      );
      setData(newData);

      // Save to Google Sheets
      const res = await fetch('/api/CustomersDocuments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex, [field]: value })
      });
      const result = await res.json();
      if (!result.success) {
        console.error('Failed to update Google Sheet');
      }
    } catch (error) {
      console.error('Error updating document:', error);
    } finally {
      setUpdatingRow(null);
    }
  };

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

  const getExpiryStyles = (days: number | null) => {
    if (days === null) return 'text-slate-300';
    if (days < 0) return 'text-rose-600 font-bold';
    return 'text-emerald-600 font-bold';
  };

  if (loading && data.length === 0) return <Loading message="Syncing with Intelligence Database..." />;

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <table className="w-full text-left border-collapse table-fixed min-w-[1800px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="py-5 px-4 font-semibold text-slate-400 text-xs uppercase tracking-wider text-center w-[60px]">#</th>
                <th className="py-5 px-6 font-semibold text-slate-900 text-sm uppercase tracking-wider text-center w-[300px]">Customer Name</th>
                
                <th className="py-5 px-2 font-semibold text-slate-500 text-xs uppercase tracking-wider text-center w-[110px]">Credit App</th>
                <th className="py-5 px-2 font-semibold text-slate-500 text-xs uppercase tracking-wider text-center w-[110px]">Licence</th>
                <th className="py-5 px-2 font-semibold text-slate-500 text-xs uppercase tracking-wider text-center w-[180px]">Licence Date</th>
                <th className="py-5 px-2 font-semibold text-indigo-500 text-xs uppercase tracking-wider text-center bg-indigo-50/30 w-[130px]">L. Days</th>
                <th className="py-5 px-2 font-semibold text-slate-500 text-xs uppercase tracking-wider text-center w-[110px]">TRN</th>
                <th className="py-5 px-2 font-semibold text-slate-500 text-xs uppercase tracking-wider text-center w-[110px]">Passport</th>
                <th className="py-5 px-2 font-semibold text-slate-500 text-xs uppercase tracking-wider text-center w-[180px]">Passport Date</th>
                <th className="py-5 px-2 font-semibold text-indigo-500 text-xs uppercase tracking-wider text-center bg-indigo-50/30 w-[130px]">P. Days</th>
                <th className="py-5 px-2 font-semibold text-slate-500 text-xs uppercase tracking-wider text-center w-[110px]">ID Card</th>
                <th className="py-5 px-2 font-semibold text-slate-500 text-xs uppercase tracking-wider text-center w-[180px]">ID Date</th>
                <th className="py-5 px-2 font-semibold text-indigo-500 text-xs uppercase tracking-wider text-center bg-indigo-50/30 w-[130px]">I. Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item, index) => {
                const licenceDays = getDaysRemaining(item.licenceDate);
                const passportDays = getDaysRemaining(item.passportDate);
                const idDays = getDaysRemaining(item.idDate);

                const renderToggle = (field: keyof CustomerDoc, value: string) => {
                  const status = getDocStatus(value);
                  return (
                    <button
                      onClick={() => handleUpdate(item.rowIndex, field, status === 'complete' ? 'No' : 'Yes')}
                      className={`group flex items-center justify-center p-2.5 rounded-xl transition-all mx-auto shadow-sm ${
                        status === 'complete' 
                          ? 'bg-emerald-500 text-white border-none shadow-emerald-200 hover:bg-emerald-600' 
                          : 'bg-slate-50 text-slate-300 border border-slate-100 hover:bg-slate-100 hover:text-slate-400'
                      }`}
                    >
                      {status === 'complete' ? <Check className="w-5 h-5 stroke-[3.5]" /> : <X className="w-5 h-5 stroke-[3.5]" />}
                    </button>
                  );
                };

                const renderDateInput = (field: keyof CustomerDoc, value: string) => {
                  return (
                    <input
                      type="date"
                      value={value.includes('/') ? value.split('/').reverse().join('-') : value}
                      onChange={(e) => handleUpdate(item.rowIndex, field, e.target.value)}
                      className="text-center text-sm font-medium py-2 px-3 rounded-xl border border-slate-100 focus:border-indigo-300 outline-none transition-all w-full max-w-[150px] mx-auto block bg-transparent hover:bg-slate-50"
                    />
                  );
                };

                const renderDays = (days: number | null) => {
                  if (days === null) return <span className="text-slate-200">---</span>;
                  return (
                    <div className={`px-2 py-2 rounded-lg text-xs font-bold ${getExpiryStyles(days)} text-center`}>
                      {days < 0 ? `${Math.abs(days)}d Overdue` : `${days}d Left`}
                    </div>
                  );
                };

                return (
                  <tr key={item.rowIndex} className="hover:bg-slate-50/50 transition-colors duration-200 group/row">
                    <td className="py-4 px-4 text-xs font-medium text-slate-400 text-center">{index + 1}</td>
                    <td className="py-4 px-6 text-center">
                      <span className="font-semibold text-slate-700 text-sm block leading-relaxed break-words">
                        {item.customerName}
                      </span>
                    </td>

                    <td className="py-4 px-2 text-center">{renderToggle('creditApp', item.creditApp)}</td>
                    <td className="py-4 px-2 text-center">{renderToggle('licence', item.licence)}</td>
                    <td className="py-4 px-2 text-center">{renderDateInput('licenceDate', item.licenceDate)}</td>
                    <td className="py-4 px-2 text-center bg-indigo-50/10 border-x border-indigo-50/20">{renderDays(licenceDays)}</td>
                    
                    <td className="py-4 px-2 text-center">{renderToggle('trn', item.trn)}</td>
                    
                    <td className="py-4 px-2 text-center">{renderToggle('passport', item.passport)}</td>
                    <td className="py-4 px-2 text-center">{renderDateInput('passportDate', item.passportDate)}</td>
                    <td className="py-4 px-2 text-center bg-indigo-50/10 border-x border-indigo-50/20">{renderDays(passportDays)}</td>
                    
                    <td className="py-4 px-2 text-center">{renderToggle('id', item.id)}</td>
                    <td className="py-4 px-2 text-center">{renderDateInput('idDate', item.idDate)}</td>
                    <td className="py-4 px-2 text-center bg-indigo-50/10 border-x border-indigo-50/20">{renderDays(idDays)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.length === 0 && !loading && <NoData title="No Records" message="Start by adding customers to your document sheet." />}
        </div>
      </div>

      {updatingRow && (
        <div className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce z-50">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="font-bold text-sm">Syncing Changes...</span>
        </div>
      )}
    </div>
  );
}
