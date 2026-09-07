const fs = require('fs');

// 1. InsightsTypes.ts
let typesContent = fs.readFileSync('D:\\\\BHS\\\\WEB\\\\app\\\\Debit\\\\DebitInsightsTab\\\\Utils\\\\InsightsTypes.ts', 'utf8');
typesContent = typesContent.replace(
  '  collections: number;\n  collectionRate: number | null;',
  '  collections: number;\n  collectionsPriorYear: number;\n  collectionsYoYChange: number | null;\n  collectionRate: number | null;'
);
fs.writeFileSync('D:\\\\BHS\\\\WEB\\\\app\\\\Debit\\\\DebitInsightsTab\\\\Utils\\\\InsightsTypes.ts', typesContent);

// 2. AsOfLedgerEngine.ts
let engineContent = fs.readFileSync('D:\\\\BHS\\\\WEB\\\\app\\\\Debit\\\\DebitInsightsTab\\\\Utils\\\\AsOfLedgerEngine.ts', 'utf8');
engineContent = engineContent.replace(
  '    const collections = computeCollections(validRows, from, to);\n    const collectionRate = netSales > 0.01 ? (collections / netSales) * 100 : null;',
  '    const collections = computeCollections(validRows, from, to);\n    const collectionsPriorYear = computeCollections(validRows, priorFrom, priorTo);\n    const collectionsYoYChange = computeYoYChange(collections, collectionsPriorYear);\n    const collectionRate = netSales > 0.01 ? (collections / netSales) * 100 : null;'
);
engineContent = engineContent.replace(
  'period: { netSales, netSalesPriorYear, netSalesYoYChange, collections, collectionRate },',
  'period: { netSales, netSalesPriorYear, netSalesYoYChange, collections, collectionsPriorYear, collectionsYoYChange, collectionRate },'
);
fs.writeFileSync('D:\\\\BHS\\\\WEB\\\\app\\\\Debit\\\\DebitInsightsTab\\\\Utils\\\\AsOfLedgerEngine.ts', engineContent);

// 3. DebitInsightsDashboard.tsx (default filter preset)
let dashboardContent = fs.readFileSync('D:\\\\BHS\\\\WEB\\\\app\\\\Debit\\\\DebitInsightsTab\\\\DebitInsightsDashboard.tsx', 'utf8');
dashboardContent = dashboardContent.replace(
  "periodPreset: 'trailing12m',",
  "periodPreset: 'ytd',"
);
fs.writeFileSync('D:\\\\BHS\\\\WEB\\\\app\\\\Debit\\\\DebitInsightsTab\\\\DebitInsightsDashboard.tsx', dashboardContent);

