import React from "react";
import { Info, CheckCircle, RotateCcw } from "lucide-react";

type Discount = {
  id: string;
  customerId: string;
  name: string;
  type: string;
  value: number;
};

type CustomerView = {
  customerId: string;
  customerName: string;
  city: string;
  discounts: Discount[];
};

import { MonthGroup } from "../page";

interface CD_SettledMonthsTabProps {
  settledMonthGroups: MonthGroup[];
  selectedCustomer: CustomerView;
  getMonthName: (m: number) => string;
  handleUnsettle: (ids: string[]) => void;
  openConfirm: (options: any) => void;
}

export default function CD_SettledMonthsTab({
  settledMonthGroups,
  selectedCustomer,
  getMonthName,
  handleUnsettle,
  openConfirm
}: CD_SettledMonthsTabProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold text-gray-900">Settled Months</h3>
      </div>
      
      {settledMonthGroups.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-16 text-center shadow-sm">
          <Info className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h4 className="text-xl font-bold text-gray-900 mb-2">No settled months</h4>
          <p className="text-gray-500 font-medium">There are no completed settlements for this customer yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {settledMonthGroups.map((g) => {
            return (
              <div key={g.key} className="bg-white border-t-4 border-t-green-500 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative">
                <div className="absolute top-4 right-4">
                  <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                    Settled
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-sm font-bold text-gray-400 pr-16 uppercase tracking-wider">
                    {g.settledCount} / {g.totalCount} Collected
                  </p>
                </div>
                <h4 className="font-bold text-xl text-gray-900 mb-6 text-center leading-tight">
                  {getMonthName(g.month)}<br/><span className="text-sm text-gray-500">{g.year}</span>
                </h4>
                <button 
                  onClick={() => {
                    openConfirm({
                      title: "Revert Settlement",
                      message: "Are you sure you want to revert this month back to Pending?",
                      confirmText: "Revert",
                      isDestructive: true,
                      onConfirm: () => handleUnsettle(g.settledIds)
                    });
                  }}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-green-50 hover:bg-orange-50 text-green-700 hover:text-orange-600 py-2.5 rounded-xl text-sm font-bold transition-all border border-green-200 hover:border-orange-200 group"
                  title="Revert to Pending"
                >
                  <CheckCircle className="w-4 h-4 group-hover:hidden" />
                  <RotateCcw className="w-4 h-4 hidden group-hover:block" />
                  <span className="group-hover:hidden">Completed</span>
                  <span className="hidden group-hover:block">Revert to Pending</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
