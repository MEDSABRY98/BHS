import React from "react";
import { Info, CheckCircle } from "lucide-react";

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

import { MonthGroup } from "./page";

interface CD_PendingMonthsTabProps {
  pendingMonthGroups: MonthGroup[];
  selectedCustomer: CustomerView;
  getMonthName: (m: number) => string;
  handleSettle: (ids: string[]) => void;
}

export default function CD_PendingMonthsTab({
  pendingMonthGroups,
  selectedCustomer,
  getMonthName,
  handleSettle
}: CD_PendingMonthsTabProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold text-gray-900">Pending Months</h3>
      </div>
      
      {pendingMonthGroups.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-16 text-center shadow-sm">
          <Info className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h4 className="text-xl font-bold text-gray-900 mb-2">No pending months</h4>
          <p className="text-gray-500 font-medium">All generated months for this customer have been settled.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {pendingMonthGroups.map((g) => {
            return (
              <div key={g.key} className="bg-white border-t-4 border-t-orange-400 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative">
                <div className="absolute top-4 right-4">
                  <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                    Pending
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
                  onClick={() => handleSettle(g.pendingIds)}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as Settled
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
