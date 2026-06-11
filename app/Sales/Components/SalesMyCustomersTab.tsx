'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Edit, Trash2, Plus, Save, X, User, AlertTriangle } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/NoDataTab';

interface SalesMyCustomersTabProps {
  userId: string;
  refreshTrigger?: number;
}

export default function SalesMyCustomersTab({ userId, refreshTrigger }: SalesMyCustomersTabProps) {
  const [loading, setLoading] = useState(true);
  const [myCustomers, setMyCustomers] = useState<any[]>([]);
  const [globalCustomers, setGlobalCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);

  // Search Add states
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchGlobalCustomers = async () => {
      try {
        const response = await fetch('/api/Sales/CustomersList');
        if (response.ok) {
          const result = await response.json();
          setGlobalCustomers(result.uniqueCustomers || []);
        }
      } catch (err) {
        console.error('Error fetching global customers:', err);
      }
    };
    fetchGlobalCustomers();
  }, []);

  const fetchMyCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/Sales/MyCustomers?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error('Failed to fetch my customers');
      const data = await response.json();
      setMyCustomers(data.data || []);
    } catch (error) {
      console.error('Error fetching my customers:', error);
      toast.error('Failed to load your customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyCustomers();
  }, [userId, refreshTrigger]);

  const filteredGlobalCustomers = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return globalCustomers.filter(c =>
      c.mainName.toLowerCase().includes(query) ||
      (c.subName && c.subName.toLowerCase().includes(query)) ||
      c.id.toLowerCase().includes(query)
    ).slice(0, 10); // Limit to 10 for performance
  }, [globalCustomers, searchQuery]);

  const filteredMyCustomers = useMemo(() => {
    if (!tableSearchQuery) return myCustomers;
    const query = tableSearchQuery.toLowerCase();
    return myCustomers.filter(c =>
      c['CUSTOMER MAIN NAME']?.toLowerCase().includes(query) ||
      c['CUSTOMER SUB NAME']?.toLowerCase().includes(query) ||
      c['CUSTOMER ID']?.toLowerCase().includes(query)
    );
  }, [myCustomers, tableSearchQuery]);

  const handleAddCustomer = async (customer: any) => {
    // Check if already mapped
    if (myCustomers.find(c => c['CUSTOMER ID'] === customer.id)) {
      toast.warning('Customer is already in your mapping');
      return;
    }

    toast.loading('Adding customer...', { id: 'add_mapping' });
    try {
      const mappingData = {
        customerId: customer.id,
        customerMainName: customer.mainName,
        customerName: customer.subName || '',
        area: '',
        market: '',
        salesRep: '',
        merchandiser: ''
      };

      const response = await fetch('/api/Sales/MyCustomers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mapping: mappingData }),
      });

      if (!response.ok) throw new Error('Failed to save mapping');

      toast.success('Customer added successfully!');
      setSearchQuery('');
      setShowDropdown(false);
      fetchMyCustomers();
    } catch (error) {
      console.error('Add customer error:', error);
      toast.error('Failed to add customer');
    } finally {
      toast.dismiss('add_mapping');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;
    toast.loading('Updating customer...', { id: 'update_mapping' });
    try {
      const mappingData = {
        customerId: editingCustomer['CUSTOMER ID'],
        customerMainName: editingCustomer['CUSTOMER MAIN NAME'],
        customerName: editingCustomer['CUSTOMER SUB NAME'],
        area: editingCustomer['AREA'],
        market: editingCustomer['MARKET'],
        salesRep: editingCustomer['SALES_REP'],
        merchandiser: editingCustomer['MERCHANDISER']
      };

      const response = await fetch('/api/Sales/MyCustomers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mapping: mappingData }),
      });

      if (!response.ok) throw new Error('Failed to update mapping');

      toast.success('Customer updated successfully!');
      setIsEditModalOpen(false);
      setEditingCustomer(null);
      fetchMyCustomers();
    } catch (error) {
      console.error('Update customer error:', error);
      toast.error('Failed to update customer');
    } finally {
      toast.dismiss('update_mapping');
    }
  };

  const handleDeleteClick = (c: any) => {
    setCustomerToDelete(c);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    const customerId = customerToDelete['CUSTOMER ID'];

    toast.loading('Deleting customer...', { id: 'del_mapping' });
    try {
      const response = await fetch(`/api/Sales/MyCustomers?userId=${encodeURIComponent(userId)}&customerId=${encodeURIComponent(customerId)}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete mapping');

      toast.success('Customer removed successfully!');
      fetchMyCustomers();
      setCustomerToDelete(null);
    } catch (error) {
      console.error('Delete customer error:', error);
      toast.error('Failed to remove customer');
    } finally {
      toast.dismiss('del_mapping');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
          <div className="flex items-center gap-3 shrink-0">
            <h1 className="text-2xl font-bold text-slate-800">My Customers</h1>
            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-200">
              {filteredMyCustomers.length} {filteredMyCustomers.length === 1 ? 'Customer' : 'Customers'}
            </span>
          </div>

          {/* Table Search */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search in your customers..."
              value={tableSearchQuery}
              onChange={e => setTableSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-green-500 outline-none transition-all shadow-sm text-sm"
            />
            {tableSearchQuery && (
              <button
                onClick={() => setTableSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Global Customer Search/Add */}
        <div className="relative w-full max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search all customers to add..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-green-500 outline-none transition-all shadow-sm text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setShowDropdown(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          {showDropdown && searchQuery && (
            <div className="absolute z-50 top-full mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
              {filteredGlobalCustomers.length > 0 ? (
                <ul className="max-h-64 overflow-y-auto">
                  {filteredGlobalCustomers.map(c => (
                    <li
                      key={c.id}
                      onClick={() => handleAddCustomer(c)}
                      className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-slate-50 flex items-center justify-between group"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">{c.mainName}</p>
                        <p className="text-xs text-slate-500">{c.id} {c.subName ? `- ${c.subName}` : ''}</p>
                      </div>
                      <button className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-center text-sm text-slate-500">No customers found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left table-auto min-w-max">
              <thead>
                <tr className="bg-slate-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-slate-500 font-bold text-center">
                  <th className="px-4 py-4">ID</th>
                  <th className="px-4 py-4">Main Name</th>
                  <th className="px-4 py-4">Sub Name</th>
                  <th className="px-4 py-4">Area</th>
                  <th className="px-4 py-4">Market</th>
                  <th className="px-4 py-4">Sales Rep</th>
                  <th className="px-4 py-4">Merchandiser</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMyCustomers.map((c, idx) => (
                  <tr key={c.ID || idx} className="hover:bg-slate-50 transition-colors text-center">
                    <td className="px-4 py-3 text-sm text-slate-500 font-medium">{c['CUSTOMER ID']}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 font-bold">{c['CUSTOMER MAIN NAME']}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c['CUSTOMER SUB NAME']}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c['AREA']}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c['MARKET']}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c['SALES_REP']}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c['MERCHANDISER']}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => { setEditingCustomer({ ...c }); setIsEditModalOpen(true); }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Mapping"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(c)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Mapping"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMyCustomers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <NoData />
                      <p className="text-center text-slate-400 mt-2">No customers match your search.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <User className="w-5 h-5 text-green-600" />
                Edit Mapping: {editingCustomer['CUSTOMER MAIN NAME']}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Area</label>
                <input
                  type="text"
                  value={editingCustomer['AREA'] || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, 'AREA': e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Market</label>
                <input
                  type="text"
                  value={editingCustomer['MARKET'] || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, 'MARKET': e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sales Representative</label>
                <input
                  type="text"
                  value={editingCustomer['SALES_REP'] || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, 'SALES_REP': e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Merchandiser</label>
                <input
                  type="text"
                  value={editingCustomer['MERCHANDISER'] || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, 'MERCHANDISER': e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-sm"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCustomerToDelete(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Remove Customer?</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to remove <strong className="text-slate-800">{customerToDelete['CUSTOMER MAIN NAME']}</strong> from your mapping? This action can be undone by adding them back later.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setCustomerToDelete(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm"
                >
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
