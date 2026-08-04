const MODULE_ROUTES: { prefix: string; name: string }[] = [
  // AdminControl is intentionally excluded — no activity tracking for the admin panel.
  { prefix: '/CashReceipt', name: 'Cash Receipt' },
  { prefix: '/CashHandover', name: 'Cash Handover' },
  { prefix: '/PettyCash', name: 'Petty Cash' },
  { prefix: '/DocumentsTracking', name: 'Documents Tracking' },
  { prefix: '/CustomersSummaries', name: 'Customers Summaries' },
  { prefix: '/DebitInsights', name: 'Debit Insights' },
  { prefix: '/Debit', name: 'Debit Analysis' },
  { prefix: '/CustomersDocuments', name: 'Customers Documents' },
  { prefix: '/InventoryAnalysis', name: 'Inventory Analysis' },
  { prefix: '/InventoryItemCode', name: 'Inventory Item Code' },
  { prefix: '/InventoryCounting', name: 'Inventory Counting' },
  { prefix: '/InventoryScrap', name: 'Inventory Scrap' },
  { prefix: '/PurchasePriceTracking', name: 'Purchase Price Tracking' },
  { prefix: '/Sales', name: 'Sales Analysis' },
  { prefix: '/LPOs', name: "LPO's" },
  { prefix: '/DataBase', name: 'Database' },
  { prefix: '/CustomersDiscounts', name: 'Customers Discounts' },
];

const SORTED_ROUTES = [...MODULE_ROUTES].sort((a, b) => b.prefix.length - a.prefix.length);

export function ResolveModuleName(pathname: string): string | null {
  if (!pathname || pathname === '/') return null;

  const match = SORTED_ROUTES.find((route) =>
    pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
  );

  return match?.name ?? null;
}
