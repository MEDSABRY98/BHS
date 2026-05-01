import React from 'react';
import { Table } from '@tanstack/react-table';
import { CustomerAnalysis } from '@/types';
import NoData from '../../../01-Unified/NoDataTab';
import { formatDmy, calculateDebtRating } from '../CstomersUtils';

interface SummaryViewProps {
  table: Table<CustomerAnalysis>;
  filteredData: CustomerAnalysis[];
  selectedCustomersForDownload: Set<string>;
  toggleCustomerSelection: (name: string) => void;
  toggleSelectAll: () => void;
  setSelectedCustomer: (name: string) => void;
  closedCustomers: Set<string>;
}

const SummaryView: React.FC<SummaryViewProps> = ({
  table,
  filteredData,
  selectedCustomersForDownload,
  toggleCustomerSelection,
  toggleSelectAll,
  setSelectedCustomer,
  closedCustomers,
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border-collapse table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-1 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-gray-200 w-10">#</th>
              <th className="px-2 py-4 text-center text-xs font-bold text-white bg-green-600 uppercase tracking-wider border-r border-gray-200 w-48">
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="checkbox"
                    checked={filteredData.length > 0 && selectedCustomersForDownload.size === filteredData.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-white bg-green-700 border-green-500 rounded focus:ring-green-500"
                    title="Select All"
                  />
                  <span>Customer Name</span>
                </div>
              </th>
              <th className="px-1 py-4 text-center text-xs font-bold text-white bg-green-600 uppercase tracking-wider border-r border-gray-200 w-24">City / Rep</th>
              <th className="px-1 py-4 text-center text-xs font-bold text-white bg-green-600 uppercase tracking-wider border-r border-gray-200 w-28">Total Debt</th>
              <th className="px-1 py-4 text-center text-xs font-bold text-white bg-blue-600 uppercase tracking-wider border-r border-blue-500 w-20">Last Pay Date</th>
              <th className="px-1 py-4 text-center text-xs font-bold text-white bg-blue-600 uppercase tracking-wider border-r border-blue-500 w-24">Last Pay Amt</th>
              <th className="px-1 py-4 text-center text-xs font-bold text-white bg-blue-600 uppercase tracking-wider border-r border-blue-500 w-24">Pay (90d)</th>
              <th className="px-1 py-4 text-center text-xs font-bold text-white bg-blue-600 uppercase tracking-wider border-r border-blue-500 w-16"># Pay (90d)</th>
              <th className="px-1 py-4 text-center text-xs font-bold text-white bg-orange-600 uppercase tracking-wider border-r border-orange-500 w-20">Last Sale Date</th>
              <th className="px-1 py-4 text-center text-xs font-bold text-white bg-orange-600 uppercase tracking-wider border-r border-orange-500 w-24">Last Sale Amt</th>
              <th className="px-1 py-4 text-center text-xs font-bold text-white bg-orange-600 uppercase tracking-wider border-r border-orange-500 w-24">Sales (90d)</th>
              <th className="px-1 py-4 text-center text-xs font-bold text-white bg-orange-600 uppercase tracking-wider border-r border-gray-200 w-16"># Sales (90d)</th>
              <th className="px-1 py-4 text-center text-xs font-bold text-white bg-purple-600 uppercase tracking-wider w-16">Rating</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={13} className="py-12"><NoData /></td></tr>
            ) : (
              table.getRowModel().rows.map((row, index) => {
                const customer = row.original;
                const rating = calculateDebtRating(customer, closedCustomers);
                return (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-1 py-2 text-center text-xs font-medium text-gray-500 border-r border-gray-100">{index + 1}</td>
                    <td className="px-2 py-2 border-r border-gray-100 overflow-hidden text-ellipsis whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedCustomersForDownload.has(customer.customerName)}
                          onChange={() => toggleCustomerSelection(customer.customerName)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3 h-3 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 shrink-0"
                        />
                        <button
                          onClick={() => setSelectedCustomer(customer.customerName)}
                          className="text-xs font-bold text-gray-900 hover:text-blue-600 hover:underline text-center w-full truncate"
                          title={customer.customerName}
                        >
                          {customer.customerName}
                        </button>
                      </div>
                    </td>
                    <td className="px-1 py-2 text-center text-xs font-medium text-gray-900 border-r border-gray-100 truncate">
                      {(() => {
                        const val = customer.salesReps;
                        if (val && val instanceof Set && val.size > 0) return Array.from(val).join(', ');
                        if (Array.isArray(val) && val.length > 0) return val.join(', ');
                        return '-';
                      })()}
                    </td>
                    <td className="px-1 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-100">
                      {customer.netDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-1 py-2 text-center text-xs font-medium text-gray-900 border-r border-gray-100">
                      {customer.lastPaymentDate ? formatDmy(customer.lastPaymentDate) : '-'}
                    </td>
                    <td className="px-1 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-100">
                      {customer.lastPaymentDate ? (customer.lastPaymentAmount?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 0) : '-'}
                    </td>
                    <td className="px-1 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-100">
                      {(customer.payments3m || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-1 py-2 text-center text-xs font-medium text-gray-900 border-r border-gray-100">{customer.paymentsCount3m || 0}</td>
                    <td className="px-1 py-2 text-center text-xs font-medium text-gray-900 border-r border-gray-100">
                      {customer.lastSalesDate ? formatDmy(customer.lastSalesDate) : '-'}
                    </td>
                    <td className="px-1 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-100">
                      {customer.lastSalesDate ? (customer.lastSalesAmount?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 0) : '-'}
                    </td>
                    <td className="px-1 py-2 text-center text-xs font-bold text-gray-900 border-r border-gray-100">
                      {(customer.sales3m || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-1 py-2 text-center text-xs font-medium text-gray-900 border-r border-gray-100">{customer.salesCount3m || 0}</td>
                    <td className="px-1 py-2 text-center text-xs font-bold border-gray-100">
                      <span className={`px-2 py-0.5 rounded-full ${rating === 'Good' ? 'bg-green-100 text-green-800' : rating === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {rating}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
            <tr>
              <td colSpan={3} className="px-6 py-4 text-center text-xs uppercase tracking-wider">Total</td>
              <td className="px-1 py-4 text-center text-xs">
                {filteredData.reduce((sum, c) => sum + c.netDebt, 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
              <td colSpan={9}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default SummaryView;
