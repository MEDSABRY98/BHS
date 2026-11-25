'use client';

import React from 'react';
import { ArrowLeft, Calendar, MapPin } from 'lucide-react';
import type { RepAgg } from './useRepCollections';

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-white font-bold tracking-[0.1em] bg-slate-900 text-center">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-6 py-5 whitespace-nowrap text-center">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-center divide-y divide-slate-50">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

const td = 'px-6 py-4 text-slate-600 text-center';
const totalTd = 'px-6 py-5 font-mono text-center text-base';

export default function SalespersonDetailsView({ rep, onBack }: { rep: RepAgg; onBack: () => void }) {
  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 fade-in duration-500">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{rep.rep} Details</h2>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-1">
            Net {money(rep.net)} • {rep.share.toFixed(1)}% of all collections • {rep.customerCount.toLocaleString()} customers
          </p>
        </div>
      </div>

      {/* Cities of this salesperson */}
      <div className="space-y-3">
        <h3 className="text-lg font-black text-slate-800">By City</h3>
        <Table head={['City', 'Net Collection', 'Share', 'No. of Payments', 'No. of Customers']}>
          {rep.cities.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                No data.
              </td>
            </tr>
          ) : (
            <>
              {rep.cities.map((c) => (
                <tr key={c.city} className="hover:bg-slate-50/50 transition-colors">
                  <td className={td}>
                    <div className="flex items-center gap-2 justify-center">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="font-bold text-slate-800">{c.city}</span>
                    </div>
                  </td>
                  <td className={td}>
                    <span className="font-mono font-black text-[#D4AF37] text-base">{money(c.net)}</span>
                  </td>
                  <td className={td}>
                    <span className="font-mono font-semibold text-slate-600">{c.share.toFixed(1)}%</span>
                  </td>
                  <td className={td}>
                    <span className="font-mono font-semibold text-emerald-600">{c.payments.toLocaleString()}</span>
                  </td>
                  <td className={td}>
                    <span className="font-mono font-semibold text-indigo-600">{c.customers.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-black border-t-2 border-slate-200 text-sm">
                <td className="px-6 py-5 text-slate-800 uppercase tracking-wider text-center">Total</td>
                <td className={`${totalTd} text-[#D4AF37]`}>{money(rep.net)}</td>
                <td className={`${totalTd} text-slate-700`}>100%</td>
                <td className={`${totalTd} text-emerald-700`}>{rep.paymentCount.toLocaleString()}</td>
                <td className={`${totalTd} text-indigo-700`}>{rep.customerCount.toLocaleString()}</td>
              </tr>
            </>
          )}
        </Table>
      </div>

      {/* Months of this salesperson */}
      <div className="space-y-3">
        <h3 className="text-lg font-black text-slate-800">By Month</h3>
        <Table head={['Month', 'Net Collection', 'No. of Payments', 'No. of Customers']}>
          {rep.months.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">
                No monthly data found.
              </td>
            </tr>
          ) : (
            <>
              {rep.months.map((m) => (
                <tr key={m.key} className="hover:bg-slate-50/50 transition-colors">
                  <td className={td}>
                    <div className="flex items-center gap-2 justify-center">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="font-bold text-slate-800">{m.label}</span>
                    </div>
                  </td>
                  <td className={td}>
                    <span className="font-mono font-black text-[#D4AF37] text-base">{money(m.net)}</span>
                  </td>
                  <td className={td}>
                    <span className="font-mono font-semibold text-emerald-600">{m.payments.toLocaleString()}</span>
                  </td>
                  <td className={td}>
                    <span className="font-mono font-semibold text-indigo-600">{m.customers.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-black border-t-2 border-slate-200 text-sm">
                <td className="px-6 py-5 text-slate-800 uppercase tracking-wider text-center">Total</td>
                <td className={`${totalTd} text-[#D4AF37]`}>{money(rep.net)}</td>
                <td className={`${totalTd} text-emerald-700`}>{rep.paymentCount.toLocaleString()}</td>
                <td className={`${totalTd} text-indigo-700`}>{rep.customerCount.toLocaleString()}</td>
              </tr>
            </>
          )}
        </Table>
      </div>
    </div>
  );
}
