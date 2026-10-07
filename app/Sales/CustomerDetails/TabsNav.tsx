'use client';

import type { CustomerDetailsTabId } from './Types';

interface TabsNavProps {
  activeTab: CustomerDetailsTabId;
  onTabChange: (tab: CustomerDetailsTabId) => void;
  customerType: 'main' | 'sub';
  subCustomersCount: number;
}

export default function TabsNav({
  activeTab,
  onTabChange,
  customerType,
  subCustomersCount,
}: TabsNavProps) {
  const tabClass = (tab: CustomerDetailsTabId) =>
    `flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${
      activeTab === tab
        ? 'text-green-600 border-green-600'
        : 'text-gray-500 border-transparent hover:text-gray-700'
    }`;

  return (
    <div className="mb-6 flex border-b border-gray-200">
      {customerType === 'sub' && (
        <button onClick={() => onTabChange('summary')} className={tabClass('summary')}>
          Sub Customer Summary
        </button>
      )}
      <button onClick={() => onTabChange('dashboard')} className={tabClass('dashboard')}>
        Dashboard
      </button>
      {customerType === 'main' && (
        <button onClick={() => onTabChange('subcustomers')} className={tabClass('subcustomers')}>
          Sub Customers ({subCustomersCount})
        </button>
      )}
      <button onClick={() => onTabChange('monthly')} className={tabClass('monthly')}>
        Sales by Month
      </button>
      <button onClick={() => onTabChange('categories')} className={tabClass('categories')}>
        Categories
      </button>
      <button onClick={() => onTabChange('products')} className={tabClass('products')}>
        Products
      </button>
      <button onClick={() => onTabChange('invoices')} className={tabClass('invoices')}>
        Invoices / LPO
      </button>
    </div>
  );
}
