import { SalesInvoice } from '@/lib/supabase';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';
import type { GroupedInvoiceRow, ProductSalesRow, SelectedInvoice, SubCustomerRow } from './Types';

export function formatDate(dateString: string) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

export async function exportProductsToExcel(
  productsData: ProductSalesRow[],
  customerName: string,
  showCosts: boolean
) {
  const headers = showCosts
    ? ['#', 'Barcode', 'Product', 'Amount', 'Avg Cost', 'Avg Price', 'Quantity', 'Purchase Count', 'LID']
    : ['#', 'Barcode', 'Product', 'Amount', 'Avg Price', 'Quantity', 'Purchase Count', 'LID'];

  const rows = productsData.map((item, index) => {
    const row: unknown[] = [index + 1, item.barcode || '-', item.product, item.amount];
    if (showCosts) {
      row.push(item.avgCost);
    }
    row.push(
      item.avgPrice,
      item.qty,
      item.invoiceCount || 0,
      item.lastInvoiceDate
        ? new Date(item.lastInvoiceDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : '-'
    );
    return row;
  });

  const safeCustomer = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'customer';
  const filename = `sales_customer_products_${safeCustomer}_${new Date().toISOString().split('T')[0]}.xlsx`;
  const numericColumns = showCosts
    ? ['Amount', 'Avg Cost', 'Avg Price', 'Quantity']
    : ['Amount', 'Avg Price', 'Quantity'];
  await exportSalesExcelTable(headers, rows, filename, {
    sheetName: 'Products',
    numericColumns,
  });
}

export async function exportInvoicesToExcel(
  groupedInvoicesData: GroupedInvoiceRow[],
  customerName: string,
  customerType: 'main' | 'sub'
) {
  const headers =
    customerType === 'main'
      ? ['Invoice Date', 'Sub Customer', 'Invoice Number', 'Amount', 'Quantity', 'Products Count']
      : ['Invoice Date', 'Invoice Number', 'Amount', 'Quantity', 'Products Count'];

  const rows = groupedInvoicesData.map((item) => {
    const row: unknown[] = [
      item.invoiceDate
        ? new Date(item.invoiceDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : '-',
    ];

    if (customerType === 'main') {
      row.push(item.subCustomerNames || '');
    }

    row.push(item.invoiceNumber, item.amount, item.qty, item.productCount);
    return row;
  });

  const safeCustomer = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'customer';
  const filename = `sales_customer_invoices_${safeCustomer}_${new Date().toISOString().split('T')[0]}.xlsx`;
  await exportSalesExcelTable(headers, rows, filename, {
    sheetName: 'Invoices',
    numericColumns: ['Amount', 'Quantity'],
  });
}

export async function exportSingleInvoiceToExcel(invoice: SelectedInvoice, showCosts: boolean) {
  const headers = showCosts
    ? ['Barcode', 'Product', 'Quantity', 'Cost', 'Price', 'Total']
    : ['Barcode', 'Product', 'Quantity', 'Price', 'Total'];

  const rows = invoice.items.map((item: SalesInvoice) => {
    const row: unknown[] = [item.barcode || '-', item.product || '-', item.qty || 0];
    if (showCosts) {
      row.push(item.productCost || 0);
    }
    row.push(item.productPrice || 0, item.amount || 0);
    return row;
  });

  const sheetName = String(invoice.invoiceNumber).replace(/[:\\/?*[\]]/g, '_').slice(0, 31);
  const numericColumns = showCosts
    ? ['Quantity', 'Cost', 'Price', 'Total']
    : ['Quantity', 'Price', 'Total'];
  await exportSalesExcelTable(headers, rows, `Invoice_${invoice.invoiceNumber}.xlsx`, {
    sheetName,
    numericColumns,
  });
}

export async function exportSubCustomersToExcel(
  subCustomersData: SubCustomerRow[],
  customerName: string
) {
  const totalSalesAmount = subCustomersData.reduce(
    (sum, item) => sum + (Number(item.totalAmount) || 0),
    0
  );
  const headers = ['#', 'Sub Customer Name', 'City', 'Total Amount', 'Total QTY', 'SKUs', 'Invoices Count', '% of Sales'];
  const rows = subCustomersData.map((item, index) => {
    const amount = Number(item.totalAmount) || 0;
    const salesShare = totalSalesAmount > 0 ? (amount / totalSalesAmount) * 100 : 0;
    return [
      index + 1,
      item.subCustomerName,
      item.city || 'Unknown',
      amount,
      item.totalQty,
      item.productsCount,
      item.invoicesCount,
      Number(salesShare.toFixed(2)),
    ];
  });
  const safeCustomer = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'customer';
  await exportSalesExcelTable(headers, rows, `sub_customers_${safeCustomer}_${new Date().toISOString().split('T')[0]}.xlsx`, {
    sheetName: 'Sub Customers',
    numericColumns: ['Total Amount', 'Total QTY', '% of Sales'],
  });
}
