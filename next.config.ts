import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // API rewrites
      { source: '/api/cash-receipt', destination: '/api/CashReceipt' },
      { source: '/api/closed-customers', destination: '/api/ClosedCustomers' },
      { source: '/api/customer-email', destination: '/api/CustomerEmail' },
      { source: '/api/customer-emails-list', destination: '/api/CustomerEmailsList' },
      { source: '/api/customers-documents', destination: '/api/CustomersDocuments' },
      { source: '/api/lulu-emails', destination: '/api/LuluEmails' },
      { source: '/api/delivery-tracking', destination: '/api/DeliveryTracking' },
      { source: '/api/documents-tracking', destination: '/api/DocumentsTracking' },
      { source: '/api/inactive-customer', destination: '/api/InactiveCustomer' },
      { source: '/api/inactive-customer-exceptions', destination: '/api/InactiveCustomer' },
      { source: '/api/notes', destination: '/api/Notes' },
      { source: '/api/petty-cash', destination: '/api/PettyCash' },
      { source: '/api/sales', destination: '/api/Sales' },
      { source: '/api/semi-closed-customers', destination: '/api/SemiClosedCustomers' },
      { source: '/api/suppliers', destination: '/api/Suppliers' },
      { source: '/api/suppliers-matching', destination: '/api/SuppliersMatching' },
      { source: '/api/vouchers', destination: '/api/Vouchers' },
      { source: '/api/waters', destination: '/api/Waters' },
      { source: '/api/spi', destination: '/api/Spi' },
      
      // Page rewrites
      { source: '/cash-receipt', destination: '/CashReceipt' },
      { source: '/customers-documents', destination: '/CustomersDocuments' },
      { source: '/customers-summaries', destination: '/CustomersSummaries' },
      { source: '/debit', destination: '/Debit' },
      { source: '/delivery-tracking', destination: '/DeliveryTracking' },
      { source: '/documents-tracking', destination: '/DocumentsTracking' },
      { source: '/inventory', destination: '/Inventory' },
      { source: '/warehouses', destination: '/Warehouses' },
      { source: '/waters', destination: '/Waters' },
      { source: '/petty-cash', destination: '/PettyCash' },
      { source: '/sales', destination: '/Sales' },
      { source: '/suppliers', destination: '/Suppliers' },
    ];
  }
};

export default nextConfig;
