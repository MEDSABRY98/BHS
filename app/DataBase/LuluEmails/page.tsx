'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, MailPlus } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';

export default function LuluEmailsDatabasePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (item: any) => {
    if (!confirm('Are you sure you want to delete this Lulu email record?')) return;
    try {
      const queryParams = new URLSearchParams();
      if (item.ID) queryParams.append('id', item.ID);
      else queryParams.append('customerId', item['CUSTOMER ID']);

      await fetch(`/DataBase/LuluEmails/api?\${queryParams.toString()}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error(error);
    }
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
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-6 py-4 font-medium border-b border-gray-100">ID</th>
                <th className="px-6 py-4 font-medium border-b border-gray-100">Customer ID</th>
                <th className="px-6 py-4 font-medium border-b border-gray-100">Customer Code</th>
                <th className="px-6 py-4 font-medium border-b border-gray-100">To</th>
                <th className="px-6 py-4 font-medium border-b border-gray-100">CC</th>
                <th className="px-6 py-4 font-medium border-b border-gray-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <NoData title="NO LULU EMAILS FOUND" />
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={item.ID || idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">{item.ID || '-'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item['CUSTOMER ID']}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item['CUSTOMER CODE']}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">{item['TO:']}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">{item['CC:']}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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
    </div>
  );
}
