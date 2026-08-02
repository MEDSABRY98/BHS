'use client';

import { Building2, TrendingUp, TrendingDown, Users, ArrowUpRight, BarChart3 } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import type { SubCustomerSummaryData } from './Types';

interface SubCustomerSummaryTabProps {
  customerName: string;
  summary: SubCustomerSummaryData | null;
  onOpenMainCustomer?: (mainCustomerName: string) => void;
}

const fmt = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SubCustomerSummaryTab({
  customerName,
  summary,
  onOpenMainCustomer,
}: SubCustomerSummaryTabProps) {
  if (!summary) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <NoData />
      </div>
    );
  }

  const isPositive = summary.ytdDiff >= 0;
  const targetId = summary.siblingRanking.find(
    (row) => row.subCustomerName.trim() === customerName.trim()
  )?.customerId;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Main Customer</p>
              <p className="text-xl font-bold text-gray-900">
                {summary.mainCustomerName || 'Not linked in data'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Sub Customer: <span className="font-semibold text-gray-800">{customerName}</span>
              </p>
            </div>
            <Building2 className="w-8 h-8 text-blue-500 shrink-0" />
          </div>
          {summary.mainCustomerName && onOpenMainCustomer && (
            <button
              onClick={() => onOpenMainCustomer(summary.mainCustomerName!)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800"
            >
              View Main Customer
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Rank Among Sub Customers</p>
              {summary.rank ? (
                <>
                  <p className="text-3xl font-black text-gray-900">
                    #{summary.rank}
                    <span className="text-lg font-bold text-gray-500 ml-2">of {summary.totalSubCustomers}</span>
                  </p>
                  {summary.shareOfMainPercent !== null && (
                    <p className="text-sm text-gray-600 mt-2">
                      {summary.shareOfMainPercent.toFixed(1)}% of main customer group sales
                    </p>
                  )}
                </>
              ) : (
                <p className="text-lg font-semibold text-gray-400">Rank unavailable</p>
              )}
            </div>
            <Users className="w-8 h-8 text-teal-500 shrink-0" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-800">YTD Comparison</h2>
            <p className="text-sm text-gray-500">
              Same period: {summary.ytdLabel} ({summary.prevYear} vs {summary.currentYear})
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white border border-gray-200 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{summary.prevYear}</p>
            <p className="text-2xl font-black text-gray-800">{fmt(summary.prevYtdAmount)}</p>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{summary.currentYear}</p>
            <p className="text-2xl font-black text-gray-800">{fmt(summary.currYtdAmount)}</p>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Change</p>
            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500" />
              )}
              <p className={`text-2xl font-black ${isPositive ? 'text-emerald-700' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}
                {fmt(summary.ytdDiff)}
              </p>
            </div>
            <p className={`text-sm font-bold mt-1 ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}
              {summary.ytdPercent.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {summary.siblingRanking.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Sub Customers Ranking</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-16">#</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Sub Customer</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-40">Total Amount</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-32">Share</th>
                </tr>
              </thead>
              <tbody>
                {summary.siblingRanking.map((row, index) => {
                  const isCurrent =
                    row.subCustomerName.trim() === customerName.trim() ||
                    (!!targetId && row.customerId.trim().toUpperCase() === targetId.trim().toUpperCase());
                  const groupTotal = summary.siblingRanking.reduce((sum, item) => sum + item.totalAmount, 0);
                  const share = groupTotal > 0 ? (row.totalAmount / groupTotal) * 100 : 0;

                  return (
                    <tr
                      key={`${row.customerId}-${row.subCustomerName}`}
                      className={`border-b border-gray-100 ${isCurrent ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'}`}
                    >
                      <td className="py-3 px-4 text-center text-sm text-gray-600">{index + 1}</td>
                      <td className="py-3 px-4 text-center text-sm text-gray-800">{row.subCustomerName}</td>
                      <td className="py-3 px-4 text-center text-sm text-gray-800 font-bold">{fmt(row.totalAmount)}</td>
                      <td className="py-3 px-4 text-center text-sm text-gray-700">{share.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
