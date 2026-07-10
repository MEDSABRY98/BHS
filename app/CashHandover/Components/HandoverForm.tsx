import React, { useState, useEffect, useMemo } from 'react';
import { PlusCircle, Trash2, CheckCircle2, Hash, Calendar, User, ClipboardList, DollarSign } from 'lucide-react';
import { bhs_supabas } from '@/lib/supabase';
import { toast } from '@/app/Components/Notification';
import { getNextHandoverId, saveCashHandover, HandoverItem } from '../Service/cash_handover_service';
import { generateHandoverPdf } from '../Utils/HandoverPdf';

interface Customer {
  id: string;
  name: string;
}

function SearchableCustomerSelect({ customers, value, onChange }: { customers: Customer[], value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const selectedCustomer = customers.find(c => c.id === value);
  const displayValue = isOpen ? searchTerm : (selectedCustomer ? selectedCustomer.name : '');

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full bg-gray-50 border-2 border-transparent rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-purple-500 font-bold text-gray-900 transition-all text-center"
        placeholder="Search customer..."
        value={displayValue}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          if (!isOpen) setIsOpen(true);
          onChange(''); // clear selection when typing
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      />
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left">
          {filteredCustomers.map(c => (
            <div
              key={c.id}
              className="px-4 py-3 hover:bg-purple-50 cursor-pointer font-bold text-gray-800 border-b border-gray-50 last:border-0 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before click
                onChange(c.id);
                setSearchTerm('');
                setIsOpen(false);
              }}
            >
              {c.name}
            </div>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="px-4 py-3 text-gray-500 font-medium text-center">No customers found</div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchableReceiverInput({ receivers, value, onChange }: { receivers: string[], value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const filteredReceivers = receivers.filter(r => r.toLowerCase().includes(value.toLowerCase()) && r !== value);

  return (
    <div className="relative w-full">
      <input
        type="text"
        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-lg font-bold text-gray-900 focus:bg-white focus:border-purple-600 transition-all outline-none"
        placeholder="Enter receiver name"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      />
      {isOpen && filteredReceivers.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto text-left">
          {filteredReceivers.map((r, idx) => (
            <div
              key={idx}
              className="px-5 py-3 hover:bg-purple-50 cursor-pointer font-bold text-gray-800 border-b border-gray-50 last:border-0 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                onChange(r);
                setIsOpen(false);
              }}
            >
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HandoverForm({ 
  currentUser, 
  editHandover, 
  onSaveComplete 
}: { 
  currentUser: any; 
  editHandover?: CashHandover | null;
  onSaveComplete?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receivers, setReceivers] = useState<string[]>([]);
  const [nextId, setNextId] = useState('');
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    whoReceived: '',
  });

  const [items, setItems] = useState<HandoverItem[]>([
    { customerId: '', customerName: '', receiptNumber: '', amount: 0 }
  ]);

  // Handle Edit Mode Data Population
  useEffect(() => {
    if (editHandover) {
      setNextId(editHandover.ID);
      setFormData({
        date: editHandover.DATE,
        whoReceived: editHandover.WHO_RECEIVED || '',
      });
      setItems(editHandover.ITEMS && editHandover.ITEMS.length > 0 
        ? editHandover.ITEMS 
        : [{ customerId: '', customerName: '', receiptNumber: '', amount: 0 }]
      );
    }
  }, [editHandover]);

  // Fetch Customers and Receivers
  useEffect(() => {
    async function fetchCustomers() {
      try {
        const { data, error } = await bhs_supabas
          .from('bhs_CUSTOMERS')
          .select('"CUSTOMER ID", "CUSTOMER MAIN NAME"')
          .order('CUSTOMER MAIN NAME');
          
        if (data) {
          setCustomers(data.map(d => ({
            id: d['CUSTOMER ID'],
            name: d['CUSTOMER MAIN NAME']
          })));
        }
      } catch (err) {
        console.error('Error fetching customers:', err);
      }
    }
    
    async function fetchReceivers() {
      try {
        const { data } = await bhs_supabas
          .from('web_CASH_HANDOVER')
          .select('WHO_RECEIVED');
        if (data) {
          const uniqueReceivers = Array.from(new Set(data.map(d => d.WHO_RECEIVED).filter(Boolean)));
          setReceivers(uniqueReceivers as string[]);
        }
      } catch (err) {
        console.error('Error fetching receivers:', err);
      }
    }

    fetchCustomers();
    fetchReceivers();
  }, []);

  // Fetch Next ID (Only if not in edit mode)
  useEffect(() => {
    if (editHandover) return;
    
    async function fetchId() {
      const id = await getNextHandoverId();
      setNextId(id);
    }
    fetchId();
  }, [editHandover]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  const handleAddItem = () => {
    setItems([...items, { customerId: '', customerName: '', receiptNumber: '', amount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      newItems.push({ customerId: '', customerName: '', receiptNumber: '', amount: 0 });
    }
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof HandoverItem, value: any) => {
    const newItems = [...items];
    if (field === 'customerId') {
      const selectedCust = customers.find(c => c.id === value);
      newItems[index].customerId = value;
      newItems[index].customerName = selectedCust ? selectedCust.name : '';
    } else {
      newItems[index][field] = value as never;
    }
    setItems(newItems);
  };

  const handleSaveAndPrint = async () => {
    if (!formData.whoReceived.trim()) {
      toast.warning('Please specify Who Received the cash.');
      return;
    }

    const validItems = items.filter(i => i.customerId && i.receiptNumber && i.amount > 0);
    if (validItems.length === 0) {
      toast.warning('Please add at least one valid receipt with Customer, Receipt Number and Amount.');
      return;
    }

    setLoading(true);

    try {
      const handoverData = {
        ID: nextId,
        DATE: formData.date,
        ITEMS: validItems,
        TOTAL_AMOUNT: totalAmount,
        WHO_RECEIVED: formData.whoReceived
      };

      const result = await saveCashHandover(handoverData);

      if (!result.success) {
        throw new Error('Failed to save to database. Please check connection or if ID already exists.');
      }

      // Generate PDF
      await generateHandoverPdf({
        data: {
          handoverId: handoverData.ID,
          date: handoverData.DATE,
          items: handoverData.ITEMS,
          totalAmount: handoverData.TOTAL_AMOUNT,
          receivedBy: handoverData.WHO_RECEIVED
        },
        filename: `${handoverData.ID}_${handoverData.DATE}`
      });

      toast.success(editHandover ? 'Handover updated successfully!' : 'Handover saved and PDF generated successfully!');
      
      // Reset form
      setFormData({ ...formData, whoReceived: '' });
      setItems([{ customerId: '', customerName: '', receiptNumber: '', amount: 0 }]);
      if (onSaveComplete) {
        onSaveComplete();
      } else {
        setNextId(await getNextHandoverId());
      }

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">NEW HANDOVER</h2>
          </div>
          
          <button
            onClick={handleSaveAndPrint}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-purple-600 text-white min-w-[220px] py-4 px-6 rounded-2xl font-black text-lg hover:bg-purple-700 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-200 transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
            <span>Save & Print</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-8 mb-12">
          <div className="group">
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 mb-3 transition-colors group-focus-within:text-purple-600">
              <Hash className="w-4 h-4" />
              Handover ID
            </label>
            <input
              type="text"
              value={nextId}
              readOnly
              className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl font-mono text-xl font-black text-gray-900 transition-all outline-none"
            />
          </div>
          
          <div className="group">
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 mb-3 transition-colors group-focus-within:text-purple-600">
              <Calendar className="w-4 h-4" />
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-lg font-bold text-gray-900 focus:bg-white focus:border-purple-600 transition-all outline-none"
            />
          </div>

          <div className="group">
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 mb-3 transition-colors group-focus-within:text-purple-600">
              <User className="w-4 h-4" />
              Who Received
            </label>
            <SearchableReceiverInput
              receivers={receivers}
              value={formData.whoReceived}
              onChange={(val) => setFormData({ ...formData, whoReceived: val })}
            />
          </div>
        </div>

        <div className="pt-8 border-t-2 border-dashed border-gray-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-purple-100 rounded-xl">
              <ClipboardList className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Receipts List</h3>
          </div>
          
          <div className="border-2 border-gray-100 rounded-3xl mb-8 pb-32">
            <table className="w-full table-fixed border-collapse">
              <thead className="bg-gray-50 border-b-2 border-gray-100">
                <tr>
                  <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-center w-[45%] rounded-tl-3xl">Customer</th>
                  <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-center w-[25%]">Invoice ID</th>
                  <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-center w-[25%]">Amount (AED)</th>
                  <th className="px-4 py-5 w-[5%] rounded-tr-3xl"></th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-gray-50">
                {items.map((item, index) => (
                  <tr key={index} className="bg-white hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 align-top relative">
                      <SearchableCustomerSelect
                        customers={customers}
                        value={item.customerId}
                        onChange={(val) => handleItemChange(index, 'customerId', val)}
                      />
                    </td>
                    <td className="px-6 py-4 align-top">
                      <input
                        type="text"
                        value={item.receiptNumber}
                        onChange={(e) => handleItemChange(index, 'receiptNumber', e.target.value)}
                        placeholder="Inv-123"
                        className="w-full bg-gray-50 border-2 border-transparent rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-purple-500 font-bold text-gray-900 transition-all text-center placeholder-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 align-top">
                      <input
                        type="number"
                        value={item.amount || ''}
                        onChange={(e) => handleItemChange(index, 'amount', parseFloat(e.target.value))}
                        placeholder="0.00"
                        className="w-full bg-purple-50 border-2 border-transparent rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-purple-600 font-black text-purple-700 transition-all text-center placeholder-purple-200 text-lg"
                      />
                    </td>
                    <td className="px-4 py-4 align-middle text-center">
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-3 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Remove Row"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <button
              onClick={handleAddItem}
              className="flex items-center gap-2 px-6 py-4 bg-gray-50 text-gray-700 font-bold rounded-2xl hover:bg-purple-50 hover:text-purple-700 transition-colors w-full sm:w-auto"
            >
              <PlusCircle className="w-5 h-5" />
              Add Receipt
            </button>

            <div className="bg-gray-900 rounded-2xl px-6 py-4 flex items-center justify-between gap-8 w-full sm:w-auto shadow-xl shadow-gray-900/10">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-gray-500" />
                <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">Total Amount</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{totalAmount.toLocaleString()}</span>
                <span className="text-lg font-bold text-gray-500">AED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
