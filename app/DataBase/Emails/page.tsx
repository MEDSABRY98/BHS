'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Mail } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';
import { toast } from '@/app/Components/Notification';

export default function EmailsDatabasePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    customerId: '',
    email: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/DataBase/Emails/api');
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
    (item['EMAIL_NAME']?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const handleOpenModal = (item: any = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        customerId: item['CUSTOMER ID'] || '',
        email: item['EMAIL_NAME'] || ''
      });
    } else {
      setEditingItem(null);
      setFormData({ customerId: '', email: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await fetch('/DataBase/Emails/api', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: editingItem.ID, 
            customerId: formData.customerId, 
            email: formData.email 
          })
        });
      } else {
        await fetch('/DataBase/Emails/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            customerId: formData.customerId, 
            email: formData.email 
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

  const handleDelete = async (item: any) => {
    if (!confirm('Are you sure you want to delete this email record?')) return;
    try {
      const queryParams = new URLSearchParams();
      if (item.ID) queryParams.append('id', item.ID);
      else queryParams.append('customerId', item['CUSTOMER ID']);

      const res = await fetch(`/DataBase/Emails/api?\${queryParams.toString()}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete email');
      
      fetchData();
      toast.success('Email deleted successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete email');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-[#D4AF37]" />
            Emails Database
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
              placeholder="Search by Customer ID or Email..."
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
                <th className="px-6 py-4 font-medium border-b border-gray-100 text-center w-96">Email Name</th>
                <th className="px-6 py-4 font-medium border-b border-gray-100 text-center w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={3} className="px-6 py-6">
                      <div className="h-6 bg-gray-50 rounded-xl w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-0">
                    <NoData title="NO EMAILS FOUND" />
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={item.ID || idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-center">{item['Customer Name']}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-center">{item['EMAIL_NAME']}</td>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editingItem ? 'Edit Email Record' : 'Add New Email'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
                <input
                  type="text"
                  required
                  value={formData.customerId}
                  onChange={(e) => setFormData({...formData, customerId: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                  placeholder="e.g. CUST-123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Name</label>
                <input
                  type="text"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                  placeholder="email@example.com, another@example.com"
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
