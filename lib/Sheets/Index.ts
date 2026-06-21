// Core utilities
export { SPREADSHEET_ID, getServiceAccountCredentials, getSheetId } from './Core';

// Invoices & Suppliers (Sheets fallback for one-time migration)
export * from './Invoices';

// Emails
export * from './Emails';

// Notes
export * from './Notes';

// Customers (Closed)
export * from './Customers';

// Inventory, Product Orders, Movements, IC
export * from '../Inventory';

// Suppliers Matching (Sheets fallback) + shared Sales types
export * from './Payments';
