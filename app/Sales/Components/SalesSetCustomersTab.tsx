'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Edit, Trash2, Save, X, User, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/NoDataTab';
import Loading from '@/app/Components/Loading';

// Custom Premium Filter Dropdown Component
interface FilterDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder: string;
}

function FilterDropdown({ value, onChange, options, placeholder }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-green-500 outline-none transition-all shadow-sm text-sm font-medium text-slate-700 flex items-center justify-between cursor-pointer"
      >
        <span className={!value ? "text-slate-400 font-normal" : "truncate font-bold text-slate-800"}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-slate-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto p-1.5 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150 scrollbar-thin">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 rounded-lg text-left text-xs font-bold transition-colors cursor-pointer ${
              !value ? 'bg-green-50 text-green-700' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {placeholder}
          </button>
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 rounded-lg text-left text-xs font-bold transition-colors cursor-pointer truncate ${
                value === opt ? 'bg-green-50 text-green-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SalesSetCustomersTabProps {
  userId: string; // The logged-in manager's User ID
  refreshTrigger?: number;
}

export default function SalesSetCustomersTab({ userId, refreshTrigger }: SalesSetCustomersTabProps) {
  const [loading, setLoading] = useState(true);
  const [myCustomers, setMyCustomers] = useState<any[]>([]);
  const [globalCustomers, setGlobalCustomers] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Searchable Rep States
  const repDropdownRef = useRef<HTMLDivElement>(null);
  const [repSearchQuery, setRepSearchQuery] = useState('');
  const [showRepDropdown, setShowRepDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (repDropdownRef.current && !repDropdownRef.current.contains(event.target as Node)) {
        setShowRepDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial data: customers list & users list
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

    const fetchUsers = async () => {
      try {
        const response = await fetch('/DataBase/Users/api');
        if (response.ok) {
          const result = await response.json();
          setUsersList(result.users || []);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };

    fetchGlobalCustomers();
    fetchUsers();
  }, []);

  const fetchMyCustomers = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/Sales/MyCustomers?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error('Failed to fetch mappings');
      const data = await response.json();
      setMyCustomers(data.data || []);
    } catch (error) {
      console.error('Error fetching mappings:', error);
      toast.error('Failed to load customer assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyCustomers();
  }, [userId, refreshTrigger]);

  // Merge list of all customers with their assignments
  const mergedCustomers = useMemo(() => {
    const mappingMap = new Map<string, any>();
    myCustomers.forEach(m => {
      mappingMap.set(String(m['CUSTOMER ID']).trim().toUpperCase(), m);
    });

    return globalCustomers.map(gc => {
      const cId = String(gc.id).trim().toUpperCase();
      const m = mappingMap.get(cId);
      return {
        'CUSTOMER ID': gc.id,
        'CUSTOMER MAIN NAME': gc.mainName,
        'CUSTOMER SUB NAME': gc.subName,
        'AREA': m ? m['AREA'] : '',
        'MARKET': m ? m['MARKET'] : '',
        'USER_ID': m ? m['USER_ID'] : '', // Representative User ID
        'SALES_REP': m ? m['SALES_REP'] : '', // Representative Name
        'MERCHANDISER': m ? m['MERCHANDISER'] : '',
        'ID': m ? m.ID : null
      };
    });
  }, [globalCustomers, myCustomers]);

  // Filter Dropdown States
  const [filterArea, setFilterArea] = useState('');
  const [filterMarket, setFilterMarket] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [filterMerchandiser, setFilterMerchandiser] = useState('');

  // Extract unique options for filters dynamically
  const uniqueAreas = useMemo(() => {
    const areas = new Set<string>();
    mergedCustomers.forEach(c => {
      if (c['AREA']) areas.add(c['AREA']);
    });
    return Array.from(areas).sort();
  }, [mergedCustomers]);

  const uniqueMarkets = useMemo(() => {
    const markets = new Set<string>();
    mergedCustomers.forEach(c => {
      if (c['MARKET']) markets.add(c['MARKET']);
    });
    return Array.from(markets).sort();
  }, [mergedCustomers]);

  const uniqueReps = useMemo(() => {
    const reps = new Set<string>();
    mergedCustomers.forEach(c => {
      if (c['SALES_REP']) reps.add(c['SALES_REP']);
    });
    return Array.from(reps).sort();
  }, [mergedCustomers]);

  const uniqueMerchandisers = useMemo(() => {
    const merchandisers = new Set<string>();
    mergedCustomers.forEach(c => {
      if (c['MERCHANDISER']) merchandisers.add(c['MERCHANDISER']);
    });
    return Array.from(merchandisers).sort();
  }, [mergedCustomers]);

  // Filter merged list by search query and dropdown filters
  const filteredCustomers = useMemo(() => {
    return mergedCustomers.filter(c => {
      if (filterArea && c['AREA'] !== filterArea) return false;
      if (filterMarket && c['MARKET'] !== filterMarket) return false;
      if (filterRep && c['SALES_REP'] !== filterRep) return false;
      if (filterMerchandiser && c['MERCHANDISER'] !== filterMerchandiser) return false;

      if (!tableSearchQuery) return true;
      const query = tableSearchQuery.toLowerCase();
      return (
        c['CUSTOMER MAIN NAME']?.toLowerCase().includes(query) ||
        c['CUSTOMER SUB NAME']?.toLowerCase().includes(query) ||
        c['CUSTOMER ID']?.toLowerCase().includes(query) ||
        c['AREA']?.toLowerCase().includes(query) ||
        c['MARKET']?.toLowerCase().includes(query) ||
        c['SALES_REP']?.toLowerCase().includes(query) ||
        c['MERCHANDISER']?.toLowerCase().includes(query)
      );
    });
  }, [mergedCustomers, tableSearchQuery, filterArea, filterMarket, filterRep, filterMerchandiser]);

  const handleSaveEdit = async () => {
    if (!editingCustomer) return;
    setIsSaving(true);
    toast.loading('Saving assignment...', { id: 'update_mapping' });
    try {
      const mappingData = {
        customerId: editingCustomer['CUSTOMER ID'],
        salesRepId: editingCustomer['USER_ID'], // representative user ID
        area: editingCustomer['AREA'],
        market: editingCustomer['MARKET'],
        merchandiser: editingCustomer['MERCHANDISER']
      };

      const response = await fetch('/api/Sales/MyCustomers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mapping: mappingData }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save assignment');
      }

      toast.success('Assignment saved successfully!');
      setIsEditModalOpen(false);
      setEditingCustomer(null);
      fetchMyCustomers();
    } catch (error: any) {
      console.error('Save assignment error:', error);
      toast.error(error.message || 'Failed to save customer assignment');
    } finally {
      setIsSaving(false);
      toast.dismiss('update_mapping');
    }
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    const customerId = customerToDelete['CUSTOMER ID'];

    toast.loading('Clearing assignment...', { id: 'del_mapping' });
    try {
      const response = await fetch(`/api/Sales/MyCustomers?userId=${encodeURIComponent(userId)}&customerId=${encodeURIComponent(customerId)}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete assignment');

      toast.success('Assignment cleared successfully!');
      fetchMyCustomers();
      setCustomerToDelete(null);
    } catch (error) {
      console.error('Delete assignment error:', error);
      toast.error('Failed to clear customer assignment');
    } finally {
      toast.dismiss('del_mapping');
    }
  };

  if (loading) {
    return <Loading fullScreen={false} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <h1 className="text-2xl font-bold text-slate-800">Set Customers</h1>
            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-200">
              {filteredCustomers.length} {filteredCustomers.length === 1 ? 'Customer' : 'Customers'}
            </span>
          </div>
        </div>

        {/* Search & 4 Equal Width Dropdown Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 w-full">
          {/* Table Search */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID..."
              value={tableSearchQuery}
              onChange={e => setTableSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-green-500 outline-none transition-all shadow-sm text-sm"
            />
            {(tableSearchQuery || filterArea || filterMarket || filterRep || filterMerchandiser) && (
              <button
                onClick={() => {
                  setTableSearchQuery('');
                  setFilterArea('');
                  setFilterMarket('');
                  setFilterRep('');
                  setFilterMerchandiser('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400"
                title="Clear All Filters"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Area Filter */}
          <FilterDropdown
            value={filterArea}
            onChange={setFilterArea}
            options={uniqueAreas}
            placeholder="All Areas"
          />

          {/* Market Filter */}
          <FilterDropdown
            value={filterMarket}
            onChange={setFilterMarket}
            options={uniqueMarkets}
            placeholder="All Markets"
          />

          {/* Sales Rep Filter */}
          <FilterDropdown
            value={filterRep}
            onChange={setFilterRep}
            options={uniqueReps}
            placeholder="All Sales Reps"
          />

          {/* Merchandiser Filter */}
          <FilterDropdown
            value={filterMerchandiser}
            onChange={setFilterMerchandiser}
            options={uniqueMerchandisers}
            placeholder="All Merchandisers"
          />
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <NoData />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="w-full overflow-hidden">
            <table className="w-full text-left table-fixed border-collapse">
              <colgroup><col className="w-[12%]" /><col className="w-[30%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[16%]" /><col className="w-[12%]" /><col className="w-[6%]" /></colgroup>
              <thead>
                <tr className="bg-slate-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-slate-500 font-bold text-center">
                  <th className="px-2 py-4">ID</th>
                  <th className="px-2 py-4 text-left">Customer Name</th>
                  <th className="px-2 py-4">Area</th>
                  <th className="px-2 py-4">Market</th>
                  <th className="px-2 py-4">Sales Rep</th>
                  <th className="px-2 py-4">Merchandiser</th>
                  <th className="px-2 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c, idx) => (
                  <tr key={c['CUSTOMER ID'] || idx} className="hover:bg-slate-50 transition-colors text-center">
                    <td className="px-2 py-3 text-xs text-slate-500 font-medium truncate" title={c['CUSTOMER ID']}>{c['CUSTOMER ID']}</td>
                    <td className="px-2 py-3 text-[11px] text-slate-700 font-bold text-left whitespace-normal break-words leading-tight">{c['CUSTOMER SUB NAME']}</td>
                    <td className="px-2 py-3 text-xs text-slate-600 truncate" title={c['AREA']}>{c['AREA'] || <span className="text-slate-300">-</span>}</td>
                    <td className="px-2 py-3 text-xs text-slate-600 truncate" title={c['MARKET']}>{c['MARKET'] || <span className="text-slate-300">-</span>}</td>
                    <td className="px-2 py-3 text-xs text-slate-600 font-medium text-slate-700 truncate" title={c['SALES_REP']}>
                      {c['SALES_REP'] || <span className="text-slate-300">Unassigned</span>}
                    </td>
                    <td className="px-2 py-3 text-xs text-slate-600 truncate" title={c['MERCHANDISER']}>{c['MERCHANDISER'] || <span className="text-slate-300">-</span>}</td>
                    <td className="px-2 py-3">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => {
                            setEditingCustomer({ ...c });
                            setRepSearchQuery(c['SALES_REP'] || '');
                            setIsEditModalOpen(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit Assignment"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {c.ID && (
                          <button
                            onClick={() => setCustomerToDelete(c)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Clear Assignment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSaving && setIsEditModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-visible">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <User className="w-5 h-5 text-green-600" />
                Assign Customer: {editingCustomer['CUSTOMER SUB NAME']}
              </h3>
              <button 
                onClick={() => !isSaving && setIsEditModalOpen(false)} 
                disabled={isSaving}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-visible">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Area</label>
                <input
                  type="text"
                  value={editingCustomer['AREA'] || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, 'AREA': e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Market</label>
                <input
                  type="text"
                  value={editingCustomer['MARKET'] || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, 'MARKET': e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-sm font-medium"
                />
              </div>
              <div className="relative z-50" ref={repDropdownRef}>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sales Representative</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search representative..."
                    value={repSearchQuery}
                    onChange={e => {
                      setRepSearchQuery(e.target.value);
                      setShowRepDropdown(true);
                      if (!e.target.value) {
                        setEditingCustomer({
                          ...editingCustomer,
                          'USER_ID': '',
                          'SALES_REP': ''
                        });
                      }
                    }}
                    onFocus={() => setShowRepDropdown(true)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-sm font-medium bg-white"
                  />
                  {repSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setRepSearchQuery('');
                        setEditingCustomer({
                          ...editingCustomer,
                          'USER_ID': '',
                          'SALES_REP': ''
                        });
                        setShowRepDropdown(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {showRepDropdown && (
                  <div className="absolute z-[1100] mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-transparent scrollbar-thin">
                    {usersList.filter(u =>
                      u.name.toLowerCase().includes(repSearchQuery.toLowerCase())
                    ).length > 0 ? (
                      usersList.filter(u =>
                        u.name.toLowerCase().includes(repSearchQuery.toLowerCase())
                      ).map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setEditingCustomer({
                              ...editingCustomer,
                              'USER_ID': u.id,
                              'SALES_REP': u.name
                            });
                            setRepSearchQuery(u.name);
                            setShowRepDropdown(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-left text-xs font-bold transition-colors flex items-center justify-between group cursor-pointer ${
                            editingCustomer['USER_ID'] === u.id
                              ? 'bg-green-50 text-green-700'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                              editingCustomer['USER_ID'] === u.id ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{u.name}</span>
                          </div>
                          {editingCustomer['USER_ID'] === u.id && (
                            <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-xs text-slate-400 italic text-center">No representatives found</div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Merchandiser</label>
                <input
                  type="text"
                  value={editingCustomer['MERCHANDISER'] || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, 'MERCHANDISER': e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-sm font-medium"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-40 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:bg-green-600/70 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCustomerToDelete(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Clear Assignment?</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to clear the representative and area/market assignments for <strong className="text-slate-800">{customerToDelete['CUSTOMER MAIN NAME']}</strong>? This will remove it from the representative's visibility list.
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
                  Yes, Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
