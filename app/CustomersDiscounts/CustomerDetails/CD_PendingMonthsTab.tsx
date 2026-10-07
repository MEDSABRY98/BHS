import React from "react";
import { Info } from "lucide-react";
import { MonthGroup } from "../Utils/settlementUtils";
import MonthSettlementCard from "./MonthSettlementCard";

interface CD_PendingMonthsTabProps {
  pendingMonthGroups: MonthGroup[];
  getMonthName: (m: number) => string;
  handleSettle: (ids: string[]) => void;
}

export default function CD_PendingMonthsTab({
  pendingMonthGroups,
  getMonthName,
  handleSettle,
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
          <p className="text-gray-500 font-medium">
            No months are waiting for their first collection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {pendingMonthGroups.map((g) => (
            <MonthSettlementCard
              key={g.key}
              group={g}
              variant="pending"
              getMonthName={getMonthName}
              onSettle={handleSettle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
