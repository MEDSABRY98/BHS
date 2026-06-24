const fs = require('fs');
const path = require('path');

const files = [
  'app/Debit/Components/YearsTab.tsx',
  'app/Debit/Components/SalesRepsTab.tsx',
  'app/Debit/Components/MonthsTab.tsx',
  'app/Debit/Components/CustomersTab/CustomersTab.tsx',
  'app/Debit/Components/CustomersTab/Views/SummaryView.tsx',
  'app/Debit/Components/CustomersTab/Views/DefaultView.tsx',
  'app/Sales/Pdf/AnalysisAllCustomersUtils.tsx'
];

for (const file of files) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  let code = fs.readFileSync(p, 'utf8');

  // Replace calculateDebtRating(..., closedCustomersSet, ...)
  code = code.replace(/calculateDebtRating\((\w+),\s*(?:closedCustomers|closedCustomersSet)\s*,\s*true\)/g, 'calculateDebtRating($1, true)');
  
  // Replace calculateDebtRating(..., closedCustomers)
  code = code.replace(/calculateDebtRating\((\w+),\s*(?:closedCustomers|closedCustomersSet)\s*\)/g, 'calculateDebtRating($1)');
  
  // Replace calculateDebtRating(info.row.original, closedCustomers)
  code = code.replace(/calculateDebtRating\(info\.row\.original,\s*(?:closedCustomers|closedCustomersSet)\s*,\s*true\)/g, 'calculateDebtRating(info.row.original, true)');
  code = code.replace(/calculateDebtRating\(info\.row\.original,\s*(?:closedCustomers|closedCustomersSet)\s*\)/g, 'calculateDebtRating(info.row.original)');

  // Fix definition in AnalysisAllCustomersUtils.tsx
  code = code.replace(/const calculateDebtRating = \(customer: CustomerAnalysis, closedCustomersSet: Set<string>, returnBreakdown: boolean = false\)/g, 'const calculateDebtRating = (customer: CustomerAnalysis, returnBreakdown: boolean = false)');

  fs.writeFileSync(p, code, 'utf8');
}
