export type SettlementRow = {
  id: string;
  month: number;
  year: number;
  status: string;
};

export type DiscountRow = {
  id: string;
  name: string;
};

export type MonthGroupItem = {
  settlementId: string;
  discountId: string;
  discountName: string;
  status: "Pending" | "Settled";
};

export type MonthGroup = {
  key: string;
  month: number;
  year: number;
  totalCount: number;
  settledCount: number;
  pendingCount: number;
  pendingIds: string[];
  settledIds: string[];
  items: MonthGroupItem[];
};

export type CustomerMonthStats = {
  total: number;
  settled: number;
  pending: number;
};

export type CustomerMonthBucket = "pending" | "semi" | "settled";

export function parseSettlementId(id: string): { discountId: string; month: number } | null {
  const match = id.match(/^S-(.+)-(\d+)$/);
  if (!match) return null;
  return { discountId: match[1], month: Number(match[2]) };
}

export function buildMonthGroups(
  settlements: SettlementRow[],
  discounts: DiscountRow[] = []
): MonthGroup[] {
  const discountNameById = new Map<string, string>();
  discounts.forEach((d) => discountNameById.set(d.id, d.name));

  const groupedMonthsMap = new Map<string, MonthGroup>();

  settlements.forEach((s) => {
    const key = `${s.year}-${s.month}`;
    if (!groupedMonthsMap.has(key)) {
      groupedMonthsMap.set(key, {
        key,
        month: s.month,
        year: s.year,
        totalCount: 0,
        settledCount: 0,
        pendingCount: 0,
        pendingIds: [],
        settledIds: [],
        items: [],
      });
    }

    const group = groupedMonthsMap.get(key)!;
    const parsed = parseSettlementId(s.id);
    const discountId = parsed?.discountId || s.id;
    const isSettled = s.status === "Settled";

    group.totalCount++;
    if (isSettled) {
      group.settledCount++;
      group.settledIds.push(s.id);
    } else {
      group.pendingCount++;
      group.pendingIds.push(s.id);
    }

    group.items.push({
      settlementId: s.id,
      discountId,
      discountName: discountNameById.get(discountId) || discountId,
      status: isSettled ? "Settled" : "Pending",
    });
  });

  return Array.from(groupedMonthsMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}

export function splitMonthGroups(groups: MonthGroup[]) {
  const pending = groups.filter((g) => g.settledCount === 0 && g.pendingCount > 0);
  const semiSettled = groups.filter((g) => g.settledCount > 0 && g.pendingCount > 0);
  const settled = groups.filter((g) => g.pendingCount === 0 && g.totalCount > 0);
  return { pending, semiSettled, settled };
}

export function getCustomerMonthStats(
  settlements: { status: string }[]
): CustomerMonthStats {
  const total = settlements.length;
  const settled = settlements.filter((s) => s.status === "Settled").length;
  return { total, settled, pending: total - settled };
}

export function classifyCustomerMonth(stats: CustomerMonthStats): CustomerMonthBucket | null {
  if (stats.total === 0) return null;
  if (stats.settled === 0) return "pending";
  if (stats.pending === 0) return "settled";
  return "semi";
}
