'use client';

import SuppliersInvoicesMonthPage from '../Components/SuppliersInvoicesMonthPage';

export default function SuppliersPurchasePage() {
  return (
    <SuppliersInvoicesMonthPage
      pageTitle="Suppliers Purchase DB"
      invoiceType="Purchase"
      templateFilename="Suppliers_Purchase_Template.xlsx"
      cardLabel="Purchase Invoices"
    />
  );
}
