import React, { useState } from 'react';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: any;
  setFilters: (filters: any) => void;
  allSalesReps: string[];
  filteredDataCount: number;
}

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  filters,
  setFilters,
  allSalesReps,
  filteredDataCount
}) => {
  const [activeTab, setActiveTab] = useState<'DATE' | 'DEBIT' | 'OVERDUE' | 'SALES'>('DATE');

  if (!isOpen) return null;

  const updateFilter = (key: string, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }));
  };

  const resetAllFilters = () => {
    setFilters({
      search: '',
      filterYear: '',
      filterMonth: '',
      dateRangeFrom: '',
      dateRangeTo: '',
      invoiceTypeFilter: 'ALL',
      matchingFilter: 'ALL',
      selectedSalesRep: 'ALL',
      closedFilter: 'HIDE',
      semiClosedFilter: 'HIDE',
      debtOperator: 'GT',
      debtAmount: '',
      collectionRateOperator: 'GT',
      collectionRateValue: '',
      collectionRateTypes: new Set(['PAYMENT', 'RETURN', 'DISCOUNT']),
      lastPaymentValue: '',
      lastPaymentUnit: 'DAYS',
      lastPaymentStatus: 'ACTIVE',
      lastPaymentAmountOperator: 'GT',
      lastPaymentAmountValue: '',
      hasOB: false,
      overdueAmount: '',
      overdueAging: 'ALL',
      netSalesOperator: 'GT',
      minTotalDebit: '',
      noSalesValue: '',
      noSalesUnit: 'DAYS',
      lastSalesStatus: 'ACTIVE',
      lastSalesAmountOperator: 'GT',
      lastSalesAmountValue: '',
      dateRangeType: 'LAST_TRANSACTION',
      debtType: 'ALL',
      selectedReps: []
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Advanced Filters</h3>
            <p className="text-sm text-gray-500">
              <span className="font-medium text-blue-600">{filteredDataCount}</span> results found
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Modal Body - Split Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-gray-50 border-r border-gray-100 p-2 space-y-1 overflow-y-auto">
            {[
              { id: 'DATE', label: 'General Filters' },
              { id: 'DEBIT', label: 'Debit & Collection' },
              { id: 'OVERDUE', label: 'Overdue' },
              { id: 'SALES', label: 'Sales Activity' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-white">
            {activeTab === 'DATE' && (
              <div className="space-y-6 max-w-lg">
                <h4 className="text-base font-semibold text-gray-800 border-b pb-2">General Filters</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Year</label>
                      <input
                        type="number"
                        placeholder="YYYY"
                        className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={filters.filterYear}
                        onChange={(e) => updateFilter('filterYear', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Month</label>
                      <input
                        type="number"
                        placeholder="MM"
                        min="1"
                        max="12"
                        className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={filters.filterMonth}
                        onChange={(e) => updateFilter('filterMonth', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">From Date</label>
                    <input
                      type="date"
                      className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={filters.dateRangeFrom}
                      onChange={(e) => updateFilter('dateRangeFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">To Date</label>
                    <input
                      type="date"
                      className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={filters.dateRangeTo}
                      onChange={(e) => updateFilter('dateRangeTo', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Invoice Type</label>
                    <select
                      className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={filters.invoiceTypeFilter}
                      onChange={(e) => updateFilter('invoiceTypeFilter', e.target.value)}
                    >
                      <option value="ALL">All (OB & SAL)</option>
                      <option value="OB">Opening Balance (OB) Only</option>
                      <option value="SAL">Sales (SAL) Only</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Status</label>
                      <select
                        value={filters.matchingFilter}
                        onChange={(e) => updateFilter('matchingFilter', e.target.value)}
                        className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="WITH_EMAIL">Customers with Email</option>
                        <option value="RATING_GOOD">Rating: Good</option>
                        <option value="RATING_MEDIUM">Rating: Medium</option>
                        <option value="RATING_BAD">Rating: Bad</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Sales Rep</label>
                      <select
                        value={filters.selectedSalesRep}
                        onChange={(e) => updateFilter('selectedSalesRep', e.target.value)}
                        className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="ALL">All Sales Reps</option>
                        {allSalesReps.map(rep => (
                          <option key={rep} value={rep}>{rep}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Closed Customers</label>
                      <select
                        value={filters.closedFilter}
                        onChange={(e) => updateFilter('closedFilter', e.target.value)}
                        className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="ALL">Show All</option>
                        <option value="HIDE">Hide Closed</option>
                        <option value="ONLY">Only Closed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Semi-Closed</label>
                      <select
                        value={filters.semiClosedFilter}
                        onChange={(e) => updateFilter('semiClosedFilter', e.target.value)}
                        className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="ALL">Show All</option>
                        <option value="HIDE">Hide Semi-Closed</option>
                        <option value="ONLY">Only Semi-Closed</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'DEBIT' && (
              <div className="space-y-6 max-w-lg">
                <h4 className="text-base font-semibold text-gray-800 border-b pb-2">Debit & Collection Logic</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Net Debit</label>
                    <div className="flex gap-2">
                      <select
                        className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={filters.debtOperator}
                        onChange={(e) => updateFilter('debtOperator', e.target.value)}
                      >
                        <option value="GT">&gt; More</option>
                        <option value="LT">&lt; Less</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Amount"
                        className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={filters.debtAmount}
                        onChange={(e) => updateFilter('debtAmount', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Collection Rate</label>
                    <div className="flex gap-2">
                      <select
                        className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={filters.collectionRateOperator}
                        onChange={(e) => updateFilter('collectionRateOperator', e.target.value)}
                      >
                        <option value="GT">&gt; More</option>
                        <option value="LT">&lt; Less</option>
                      </select>
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder="Percentage"
                          className="w-full bg-white border text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                          value={filters.collectionRateValue}
                          onChange={(e) => updateFilter('collectionRateValue', e.target.value)}
                        />
                        <span className="absolute right-3 top-2.5 text-gray-400 text-sm">%</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <span className="block text-xs font-semibold text-gray-500 mb-3 uppercase">Includes:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {['PAYMENT', 'RETURN', 'DISCOUNT'].map(type => (
                        <button
                          key={type}
                          onClick={() => {
                            const newSet = new Set(filters.collectionRateTypes);
                            if (newSet.has(type)) newSet.delete(type);
                            else newSet.add(type);
                            updateFilter('collectionRateTypes', newSet);
                          }}
                          className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${filters.collectionRateTypes.has(type)
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'OVERDUE' && (
              <div className="space-y-6 max-w-lg">
                <h4 className="text-base font-semibold text-gray-800 border-b pb-2">Overdue Filtering</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Min Overdue Amount</label>
                    <input
                      type="number"
                      placeholder="Amount"
                      className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      value={filters.overdueAmount}
                      onChange={(e) => updateFilter('overdueAmount', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Aging Bucket</label>
                    <select
                      value={filters.overdueAging}
                      onChange={(e) => updateFilter('overdueAging', e.target.value)}
                      className="w-full bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="ALL">All Overdue</option>
                      <option value="AT_DATE">Current (At Date)</option>
                      <option value="1-30">1-30 Days</option>
                      <option value="31-60">31-60 Days</option>
                      <option value="61-90">61-90 Days</option>
                      <option value="91-120">91-120 Days</option>
                      <option value="OLDER">Older than 120 Days</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'SALES' && (
              <div className="space-y-6 max-w-lg">
                <h4 className="text-base font-semibold text-gray-800 border-b pb-2">Sales Activity</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase">Net Sales Volume</label>
                    <div className="flex gap-2">
                      <select
                        className="w-24 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={filters.netSalesOperator}
                        onChange={(e) => updateFilter('netSalesOperator', e.target.value)}
                      >
                        <option value="GT">&gt; More</option>
                        <option value="LT">&lt; Less</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Amount"
                        className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={filters.minTotalDebit}
                        onChange={(e) => updateFilter('minTotalDebit', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
          <button
            onClick={resetAllFilters}
            className="text-red-600 hover:text-red-700 text-sm font-semibold px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
          >
            Reset All Filters
          </button>
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all shadow-blue-200"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterModal;
