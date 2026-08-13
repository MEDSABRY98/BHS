import React from "react";
import { CheckCircle, RotateCcw } from "lucide-react";
import { MonthGroup } from "../Utils/settlementUtils";

type MonthCardVariant = "pending" | "semi" | "settled";

const variantStyles: Record<
  MonthCardVariant,
  { border: string; badge: string; badgeLabel: string }
> = {
  pending: {
    border: "border-t-orange-400",
    badge: "bg-orange-100 text-orange-700",
    badgeLabel: "Pending",
  },
  semi: {
    border: "border-t-amber-400",
    badge: "bg-amber-100 text-amber-700",
    badgeLabel: "Partial",
  },
  settled: {
    border: "border-t-green-500",
    badge: "bg-green-100 text-green-700",
    badgeLabel: "Settled",
  },
};

interface MonthSettlementCardProps {
  group: MonthGroup;
  variant: MonthCardVariant;
  getMonthName: (m: number) => string;
  onSettle?: (ids: string[]) => void;
  onUnsettle?: (ids: string[]) => void;
  openConfirm?: (options: {
    title: string;
    message: string;
    confirmText: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => void;
}

export default function MonthSettlementCard({
  group,
  variant,
  getMonthName,
  onSettle,
  onUnsettle,
  openConfirm,
}: MonthSettlementCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`bg-white border-t-4 ${styles.border} rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative`}
    >
      <div className="absolute top-4 right-4">
        <span
          className={`${styles.badge} text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider`}
        >
          {styles.badgeLabel}
        </span>
      </div>

      <div className="mb-4">
        <p className="text-sm font-bold text-gray-400 pr-16 uppercase tracking-wider">
          {group.settledCount} / {group.totalCount} Collected
        </p>
      </div>

      <h4 className="font-bold text-xl text-gray-900 mb-4 text-center leading-tight">
        {getMonthName(group.month)}
        <br />
        <span className="text-sm text-gray-500">{group.year}</span>
      </h4>

      <div className="space-y-2 mb-4">
        {group.items.map((item) => (
          <div
            key={item.settlementId}
            className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate">{item.discountName}</p>
              <p
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  item.status === "Settled" ? "text-green-600" : "text-orange-600"
                }`}
              >
                {item.status}
              </p>
            </div>

            {item.status === "Pending" && onSettle && (
              <button
                onClick={() => onSettle([item.settlementId])}
                className="shrink-0 flex items-center gap-1 bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Settle
              </button>
            )}

            {item.status === "Settled" && onUnsettle && openConfirm && (
              <button
                onClick={() =>
                  openConfirm({
                    title: "Revert Settlement",
                    message: `Revert "${item.discountName}" back to Pending?`,
                    confirmText: "Revert",
                    isDestructive: true,
                    onConfirm: () => onUnsettle([item.settlementId]),
                  })
                }
                className="shrink-0 flex items-center gap-1 bg-green-50 hover:bg-orange-50 text-green-700 hover:text-orange-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-green-200 hover:border-orange-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Revert
              </button>
            )}
          </div>
        ))}
      </div>

      {variant === "pending" && onSettle && group.pendingIds.length > 1 && (
        <button
          onClick={() => onSettle(group.pendingIds)}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2.5 rounded-xl text-sm font-bold transition-all border border-gray-200"
        >
          <CheckCircle className="w-4 h-4" />
          Settle All
        </button>
      )}
    </div>
  );
}
