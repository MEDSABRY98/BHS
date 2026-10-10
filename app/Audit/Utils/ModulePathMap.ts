const MODULE_ROUTES: { prefix: string; name: string }[] = [
  // AdminControl is intentionally excluded — no activity tracking for the admin panel.
  { prefix: '/Vouchers', name: 'Vouchers' },
  { prefix: '/DocumentsTracking', name: 'Documents Tracking' },
  { prefix: '/CustomersAnalysis', name: 'Customers Analysis' },
  { prefix: '/SuppliersAnalysis', name: 'Suppliers Analysis' },
  { prefix: '/PaymentAnalysis', name: 'Payments Analysis' },
  { prefix: '/CustomersDocuments', name: 'Customers Documents' },
  { prefix: '/FinancialModel', name: 'Financial Model' },
  { prefix: '/PurchasePlanning', name: 'Purchase Planning' },

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
