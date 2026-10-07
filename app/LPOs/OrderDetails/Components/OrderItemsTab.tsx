'use client';

import { Package, Trash2, Undo2 } from 'lucide-react';

interface OrderItemsTabProps {
  items: any[];
  canEdit: boolean;
  totalAmount: number;
  toggleItemStatus: (id: string) => void;
  handleQtyChange: (id: string, value: string) => void;
}

export default function OrderItemsTab({
  items,
  canEdit,
  totalAmount,
  toggleItemStatus,
  handleQtyChange
}: OrderItemsTabProps) {
  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8 px-2">
        <h3 className="text-2xl font-black text-black">Order Items</h3>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Value</p>
            <p className="text-2xl font-black text-black">AED {totalAmount.toFixed(2)}</p>
          </div>
          <div className="px-4 py-2 bg-black text-[#D4AF37] rounded-xl text-xs font-black uppercase tracking-widest">
            {items.length} Products
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[15%]">Barcode</th>
              <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[30%]">Product Name</th>
              <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[10%]">Unit</th>
              <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[10%]">Price</th>
              <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[10%]">Requested</th>
              <th className="pb-6 px-4 text-[10px] font-black text-black uppercase tracking-[0.2em] w-[10%]">Sent</th>
              <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[10%]">Status</th>
              {canEdit && <th className="pb-6 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-[5%]">Reject</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => (
              <tr key={item.ID} className={`group transition-all ${item.ITEMS_STATUS === 'Rejected' ? 'bg-red-50/30' : 'hover:bg-gray-50/50'}`}>
                <td className="py-6 px-4 text-center">
                  <span className={`text-sm ${item.ITEMS_STATUS === 'Rejected' ? 'text-red-400 line-through' : 'text-gray-600'}`}>
                    {item.bhs_PRODUCTS?.["PRODUCT BARCODE"]}
                  </span>
                </td>
                <td className="py-6 px-4 text-center">
                  <span className={`text-sm font-medium ${item.ITEMS_STATUS === 'Rejected' ? 'text-red-500 line-through opacity-50' : 'text-black'}`}>
                    {item.bhs_PRODUCTS?.["PRODUCT NAME"]}
                  </span>
                </td>
                <td className="py-6 px-4 text-center">
                  <span className={`text-sm ${item.ITEMS_STATUS === 'Rejected' ? 'text-red-400' : 'text-gray-600'}`}>
                    {item.UNIT}
                  </span>
                </td>
                <td className="py-6 px-4 text-center">
                  <span className="text-gray-600 text-sm">{item.PRICE}</span>
                </td>
                <td className="py-6 px-4 text-center">
                  <span className="text-gray-400 text-sm">{item.QTY_REQUEST}</span>
                </td>
                <td className="py-6 px-4 text-center">
                  <div className="flex justify-center">
                    <input 
                      type="text" 
                      disabled={item.ITEMS_STATUS === 'Rejected' || !canEdit}
                      value={item.QTY_RECEIVED || ''}
                      onChange={(e) => handleQtyChange(item.ID, e.target.value)}
                      placeholder="0"
                      className={`w-24 bg-gray-50 border border-gray-100 rounded-xl py-2 px-3 text-center font-black text-black focus:ring-2 focus:ring-black/10 outline-none transition-all ${item.ITEMS_STATUS === 'Rejected' || !canEdit ? 'opacity-20' : ''}`}
                    />
                  </div>
                </td>
                <td className="py-6 px-4 text-center">
                  <div className={`inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                    item.ITEMS_STATUS === 'Approved' ? 'bg-emerald-50 text-emerald-600' :
                    item.ITEMS_STATUS === 'Pending' ? 'bg-blue-50 text-blue-600' :
                    item.ITEMS_STATUS === 'Rejected' ? 'bg-red-50 text-red-600' :
                    'bg-gray-50 text-gray-600'
                  }`}>
                    {item.ITEMS_STATUS || 'Pending'}
                  </div>
                </td>
                {canEdit && (
                  <td className="py-6 px-4 text-center">
                    <div className="flex justify-center">
                      <button 
                        onClick={() => toggleItemStatus(item.ID)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          item.ITEMS_STATUS === 'Rejected' 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                            : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'
                        }`}
                        title={item.ITEMS_STATUS === 'Rejected' ? "Restore Item" : "Reject Item"}
                      >
                        {item.ITEMS_STATUS === 'Rejected' ? <Undo2 className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
