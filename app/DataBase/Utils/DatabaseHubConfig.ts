import {
  UserCircle,
  Package,
  FileSpreadsheet,
  Building2,
  Users,
  Database,
  ArrowLeftRight,
  Hash,
  Truck,
  Receipt,
  type LucideIcon,
} from 'lucide-react';

export type DatabaseCategoryId =
  | 'CUSTOMERS_DEBT'
  | 'PRODUCTS_INVENTORY'
  | 'SALES'
  | 'SUPPLIERS_PURCHASES'
  | 'SYSTEM_ADMIN';

export interface DatabaseCategory {
  id: DatabaseCategoryId;
  title: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  tables: string[];
}

export interface DatabaseNavItem {
  id: string;
  href: string;
  icon: LucideIcon;
  label: string;
  category: DatabaseCategoryId;
}

export const DATABASE_CATEGORIES: DatabaseCategory[] = [
  {
    id: 'CUSTOMERS_DEBT',
    title: 'Customers & Debit',
    label: 'Customers & Debit',
    description: 'Manage customers profiles, statements, and email configurations.',
    href: '/DataBase/Customers',
    icon: UserCircle,
    color: 'from-blue-500 to-blue-600',
    tables: ['Customers DB', 'Debit DB', 'Emails DB', 'Lulu Emails DB'],
  },
  {
    id: 'PRODUCTS_INVENTORY',
    title: 'Products & Inventory',
    label: 'Products & Inventory',
    description: 'Centralized catalog for all products and stock movements.',
    href: '/DataBase/Products',
    icon: Package,
    color: 'from-amber-500 to-amber-600',
    tables: ['Products DB', 'Inventory Item Code', 'Inventory Moves'],
  },
  {
    id: 'SALES',
    title: 'Sales & Operations',
    label: 'Sales & Operations',
    description: 'Track daily sales and operational transactions.',
    href: '/DataBase/Sales',
    icon: FileSpreadsheet,
    color: 'from-emerald-500 to-emerald-600',
    tables: ['Sales DB'],
  },
  {
    id: 'SUPPLIERS_PURCHASES',
    title: 'Suppliers & Purchases',
    label: 'Suppliers & Purchases',
    description: 'Manage suppliers, purchases, and refunds operations.',
    href: '/DataBase/Suppliers',
    icon: Building2,
    color: 'from-purple-500 to-purple-600',
    tables: ['Suppliers DB', 'Suppliers Purchase', 'Suppliers Refund'],
  },
  {
    id: 'SYSTEM_ADMIN',
    title: 'System & Administration',
    label: 'System & Admin',
    description: 'Manage system users and personnel access.',
    href: '/DataBase/Personnel',
    icon: Users,
    color: 'from-gray-700 to-gray-900',
    tables: ['Personnel DB', 'Users DB'],
  },
];

export const DATABASE_NAV_ITEMS: DatabaseNavItem[] = [
  { id: 'db-customers', href: '/DataBase/Customers', icon: UserCircle, label: 'Customers DB', category: 'CUSTOMERS_DEBT' },
  { id: 'db-debit', href: '/DataBase/Debit', icon: Database, label: 'Debit DB', category: 'CUSTOMERS_DEBT' },
  { id: 'db-emails', href: '/DataBase/Emails', icon: Database, label: 'Emails DB', category: 'CUSTOMERS_DEBT' },
  { id: 'db-lulu-emails', href: '/DataBase/LuluEmails', icon: Database, label: 'Lulu Emails DB', category: 'CUSTOMERS_DEBT' },

  { id: 'db-products', href: '/DataBase/Products', icon: Package, label: 'Products DB', category: 'PRODUCTS_INVENTORY' },
  { id: 'db-inv-itemcode', href: '/DataBase/InventoryItemCode', icon: Hash, label: 'Inventory Item Code', category: 'PRODUCTS_INVENTORY' },
  { id: 'db-inv-moves', href: '/DataBase/InventoryMoves', icon: ArrowLeftRight, label: 'Inventory Moves', category: 'PRODUCTS_INVENTORY' },

  { id: 'db-sales', href: '/DataBase/Sales', icon: FileSpreadsheet, label: 'Sales DB', category: 'SALES' },

  { id: 'db-suppliers', href: '/DataBase/Suppliers', icon: Building2, label: 'Suppliers DB', category: 'SUPPLIERS_PURCHASES' },
  { id: 'db-suppliers-invoices', href: '/DataBase/SuppliersStatement/Invoices', icon: Truck, label: 'Suppliers Invoices', category: 'SUPPLIERS_PURCHASES' },
  { id: 'db-suppliers-refund', href: '/DataBase/SuppliersStatement/Refunds', icon: Truck, label: 'Suppliers Refund', category: 'SUPPLIERS_PURCHASES' },
  { id: 'db-suppliers-purchase-details', href: '/DataBase/SuppliersPurchaseDetails', icon: Receipt, label: 'Suppliers Purchase Details', category: 'SUPPLIERS_PURCHASES' },

  { id: 'db-personnel', href: '/DataBase/Personnel', icon: Users, label: 'Personnel DB', category: 'SYSTEM_ADMIN' },
  { id: 'db-users', href: '/DataBase/Users', icon: Users, label: 'Users DB', category: 'SYSTEM_ADMIN' },
];

export const getDatabaseNavItemsByCategory = (categoryId: DatabaseCategoryId) =>
  DATABASE_NAV_ITEMS.filter((item) => item.category === categoryId);

export const findDatabaseNavItemByPath = (pathname: string) =>
  DATABASE_NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
