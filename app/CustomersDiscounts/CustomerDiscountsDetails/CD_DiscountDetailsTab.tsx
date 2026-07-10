import React from "react";
import { Info, X, Edit2, Trash2, Loader2, Save } from "lucide-react";

type Discount = {
  id: string;
  customerId: string;
  name: string;
  type: string;
  value: number;
};

type CustomerView = {
  customerId: string;
  customerName: string;
  city: string;
  discounts: Discount[];
};

interface CD_DiscountDetailsTabProps {
  selectedCustomer: CustomerView;
  editingDiscountId: string | null;
  setEditingDiscountId: (id: string | null) => void;
  editDiscountName: string;
  setEditDiscountName: (v: string) => void;
  editDiscountType: "percentage" | "fixed_amount";
  setEditDiscountType: (v: "percentage" | "fixed_amount") => void;
  editDiscountValue: string;
  setEditDiscountValue: (v: string) => void;
  saveEditDiscount: () => void;
  cancelEditDiscount: () => void;
  handleDeleteDiscount: (id: string) => void;
  isSubmitting: boolean;
  startEditDiscount: (d: Discount) => void;
}

export default function CD_DiscountDetailsTab({
  selectedCustomer,
  editingDiscountId,
  editDiscountName,
  setEditDiscountName,
  editDiscountType,
  setEditDiscountType,
  editDiscountValue,
  setEditDiscountValue,
  saveEditDiscount,
  cancelEditDiscount,
  handleDeleteDiscount,
  isSubmitting,
  startEditDiscount
}: CD_DiscountDetailsTabProps) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold text-gray-900">Registered Configs</h3>
      </div>
      
      {selectedCustomer.discounts.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-16 text-center shadow-sm">
          <Info className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h4 className="text-xl font-bold text-gray-900 mb-2">No configs found</h4>
          <p className="text-gray-500 font-medium">There are no discounts or rentals configured for this customer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {selectedCustomer.discounts.map((d) => (
            <div key={d.id} className="bg-white border border-gray-100 border-t-4 border-t-[#D4AF37] rounded-3xl p-6 shadow-sm hover:shadow-lg transition-shadow relative group flex flex-col h-full">
              
              {editingDiscountId === d.id ? (
                <div className="space-y-4 flex flex-col h-full">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-gray-900">Edit Discount</h4>
                    <button onClick={cancelEditDiscount} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Name</label>
                    <input type="text" value={editDiscountName} onChange={e => setEditDiscountName(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl mt-1 text-sm focus:ring-2 focus:ring-[#D4AF37] outline-none font-medium" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Type</label>
                      <div className="flex bg-gray-100 p-1 rounded-xl h-[42px]">
                        <button
                          type="button"
                          onClick={() => setEditDiscountType("fixed_amount")}
                          className={`flex-1 flex items-center justify-center rounded-lg font-bold transition-all text-xs ${
                            editDiscountType === "fixed_amount" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                          }`}
                        >
                          AED
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditDiscountType("percentage")}
                          className={`flex-1 flex items-center justify-center rounded-lg font-bold transition-all text-xs ${
                            editDiscountType === "percentage" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                          }`}
                        >
                          %
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Value</label>
                      <input type="number" min="0" step="0.01" value={editDiscountValue} onChange={e => setEditDiscountValue(e.target.value)} className="w-full px-4 bg-gray-50 border border-gray-200 rounded-xl h-[42px] text-sm focus:ring-2 focus:ring-[#D4AF37] outline-none font-medium" />
                    </div>
                  </div>

                  <div className="mt-auto pt-2">
                    <button 
                      onClick={saveEditDiscount}
                      disabled={isSubmitting}
                      className="w-full bg-[#D4AF37] hover:bg-[#C5A030] text-gray-900 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-xl text-gray-900 truncate pr-4">{d.name}</h4>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditDiscount(d)} className="p-2 text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteDiscount(d.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-6">
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border border-gray-200">
                      {d.type === "percentage" ? "PERCENTAGE" : "FIXED AMOUNT"}
                    </span>
                  </div>

                  <div className="mt-auto bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Value / Rate</p>
                    <p className="text-3xl font-black text-gray-900">
                      {d.value}
                      <span className="text-base font-bold text-gray-400 ml-1">
                        {d.type === "percentage" ? "%" : "AED"}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
