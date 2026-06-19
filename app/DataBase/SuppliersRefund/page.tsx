'use client';

import SuppliersInvoicesMonthPage from '../Components/SuppliersInvoicesMonthPage';

export default function SuppliersRefundPage() {
  return (
    <SuppliersInvoicesMonthPage
      pageTitle="Suppliers Refund DB"
      invoiceType="Refund"
      templateFilename="Suppliers_Refund_Template.xlsx"
      cardLabel="Refund Invoices"
    />
  );
}
