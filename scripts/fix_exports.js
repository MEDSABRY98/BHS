const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), 'app', 'Debit', 'Components', 'CustomersTab', 'CustomersTab.tsx');
let code = fs.readFileSync(p, 'utf8');
code = code.replace(/exportToExcel\(filteredData, 'Customers_Report', closedCustomers, data, yearlyPivotData\)/g, "exportToExcel(filteredData, 'Customers_Report', data, yearlyPivotData)");
code = code.replace(/exportToPDF\(filteredData, 'Customers_PDF_Report', closedCustomers\)/g, "exportToPDF(filteredData, 'Customers_PDF_Report')");
fs.writeFileSync(p, code, 'utf8');

const p2 = path.join(process.cwd(), 'app', 'Debit', 'Components', 'CustomersTab', 'CstomersUtils.ts');
let code2 = fs.readFileSync(p2, 'utf8');
code2 = code2.replace(/export const exportToExcel = \(filteredData: CustomerAnalysis\[\], fileName: string, closedCustomersSet: Set<string>, data: InvoiceRow\[\], yearlyPivotData: any\) => \{/g, "export const exportToExcel = (filteredData: CustomerAnalysis[], fileName: string, data: InvoiceRow[], yearlyPivotData: any) => {");
fs.writeFileSync(p2, code2, 'utf8');

const p3 = path.join(process.cwd(), 'app', 'Debit', 'Pdf', 'CustomersUtils.ts');
if (fs.existsSync(p3)) {
  let code3 = fs.readFileSync(p3, 'utf8');
  code3 = code3.replace(/export const exportToPDF = async \(filteredData: CustomerAnalysis\[\], fileName: string, closedCustomersSet: Set<string>\)/g, "export const exportToPDF = async (filteredData: CustomerAnalysis[], fileName: string)");
  fs.writeFileSync(p3, code3, 'utf8');
}
