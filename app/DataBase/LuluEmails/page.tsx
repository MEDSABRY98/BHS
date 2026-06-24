'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, MailPlus } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';
import { toast } from '@/app/Components/Notification';

export default function LuluEmailsDatabasePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    customerId: '',
    customerCode: '',
    to: '',
    cc: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/DataBase/LuluEmails/api');
      const json = await res.json();
      if (json.data) {
        setData(json.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(item => 
    (item['CUSTOMER ID']?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (item['CUSTOMER CODE']?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (item['TO:']?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const handleOpenModal = (item: any = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        customerId: item['CUSTOMER ID'] || '',
        customerCode: item['CUSTOMER CODE'] || '',
        to: item['TO:'] || '',
        cc: item['CC:'] || ''
      });
    } else {
      setEditingItem(null);
      setFormData({ customerId: '', customerCode: '', to: '', cc: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await fetch('/DataBase/LuluEmails/api', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: editingItem.ID, 
            customerId: formData.customerId, 
            customerCode: formData.customerCode,
            to: formData.to,
            cc: formData.cc
          })
        });
      } else {
        await fetch('/DataBase/LuluEmails/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            customerId: formData.customerId, 
            customerCode: formData.customerCode,
            to: formData.to,
            cc: formData.cc
          })
        });
      }
      setIsModalOpen(false);
      fetchData();
      toast.success(editingItem ? 'Email updated successfully!' : 'Email added successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save email');
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const queryParams = new URLSearchParams();
      if (itemToDelete.ID) queryParams.append('id', itemToDelete.ID);
      else queryParams.append('customerId', itemToDelete['CUSTOMER ID']);

      const res = await fetch(`/DataBase/LuluEmails/api?\${queryParams.toString()}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete email');
      
      fetchData();
      toast.success('Email deleted successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete email');
    } finally {
      setItemToDelete(null);
    }
  };

  const handleDelete = (item: any) => {
    setItemToDelete(item);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MailPlus className="w-6 h-6 text-[#D4AF37]" />
            Lulu Emails Database
          </h1>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#C5A028] text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add New
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Customer ID, Code, or TO..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-6 py-4 font-medium border-b border-gray-100 text-center w-64">Customer Name</th>
                <th className="px-6 py-4 font-medium border-b border-gray-100 text-center w-32">Customer Code</th>
                <th className="px-6 py-4 font-medium border-b border-gray-100 text-center w-64">To</th>
                <th className="px-6 py-4 font-medium border-b border-gray-100 text-center w-64">CC</th>
                <th className="px-6 py-4 font-medium border-b border-gray-100 text-center w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-6">
                      <div className="h-6 bg-gray-50 rounded-xl w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <NoData title="NO LULU EMAILS FOUND" />
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={item.ID || idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-center">{item['Customer Name']}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-center">{item['CUSTOMER CODE']}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate mx-auto text-center">{item['TO:']}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate mx-auto text-center">{item['CC:']}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenModal(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editingItem ? 'Edit Lulu Email Record' : 'Add New Lulu Email'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
                  <input
                    type="text"
                    required
                    value={formData.customerId}
                    onChange={(e) => setFormData({...formData, customerId: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Code</label>
                  <input
                    type="text"
                    value={formData.customerCode}
                    onChange={(e) => setFormData({...formData, customerCode: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TO: Emails (comma separated)</label>
                <textarea
                  required
                  rows={2}
                  value={formData.to}
                  onChange={(e) => setFormData({...formData, to: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CC: Emails (comma separated)</label>
                <textarea
                  rows={2}
                  value={formData.cc}
                  onChange={(e) => setFormData({...formData, cc: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#C5A028] text-white rounded-xl font-medium transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Email</h3>
              <p className="text-gray-500 text-sm">
                Are you sure you want to delete this Lulu email record? This action cannot be undone.
              </p>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
