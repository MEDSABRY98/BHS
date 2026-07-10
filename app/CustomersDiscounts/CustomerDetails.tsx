import React from "react";
import { ArrowLeft, User, Clock, CheckCircle } from "lucide-react";
import CD_DiscountDetailsTab from "./CD_DiscountDetailsTab";
import CD_PendingMonthsTab from "./CD_PendingMonthsTab";
import CD_SettledMonthsTab from "./CD_SettledMonthsTab";

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

type Settlement = {
  id: string;
  customerId: string;
  month: number;
  year: number;
  status: string;
  notes: string;
};

interface CustomerDetailsProps {
  selectedCustomer: CustomerView;
  activeTab: "details" | "pending" | "settled";
  setActiveTab: (tab: "details" | "pending" | "settled") => void;
  setCurrentView: (view: "grid" | "add" | "details") => void;
  setSelectedCustomer: (c: null) => void;
  pendingSettlements: Settlement[];
  settledSettlements: Settlement[];
  getMonthName: (m: number) => string;
  handleSettle: (id: string) => void;
  handleUnsettle: (id: string) => void;
  openConfirm: (options: any) => void;
  
  // Edit & Delete handlers for DiscountDetailsTab
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

export default function CustomerDetails(props: CustomerDetailsProps) {
  const {
    selectedCustomer,
    activeTab,
    setActiveTab,
    setCurrentView,
    setSelectedCustomer
  } = props;

  return (
    <div className="flex-1 overflow-y-auto p-8 animate-in fade-in duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm sticky top-0 z-10 mb-8">
          <div className="flex items-center gap-6 mb-8">
            <button
              onClick={() => {
                setCurrentView("grid");
                setSelectedCustomer(null);
              }}
              className="p-3 bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all border border-gray-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="bg-[#D4AF37]/10 p-4 rounded-2xl">
                <User className="w-8 h-8 text-[#D4AF37]" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 leading-tight">{selectedCustomer.customerName}</h2>
                <p className="text-gray-500 font-medium">{selectedCustomer.city}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 p-1.5 bg-gray-50 rounded-2xl border border-gray-200 overflow-x-auto w-full max-w-full custom-scrollbar">
            <button
              onClick={() => setActiveTab("details")}
              className={`flex-1 min-w-[150px] py-3.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === "details"
                  ? "bg-white text-gray-900 shadow-sm border border-gray-100"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50"
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span className="truncate">Discount Details</span>
            </button>
            
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex-1 min-w-[150px] py-3.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === "pending"
                  ? "bg-white text-gray-900 shadow-sm border border-gray-100"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50"
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span className="truncate">Pending Months</span>
            </button>
            
            <button
              onClick={() => setActiveTab("settled")}
              className={`flex-1 min-w-[150px] py-3.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === "settled"
                  ? "bg-white text-gray-900 shadow-sm border border-gray-100"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50"
              }`}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">Settled Months</span>
            </button>
          </div>
        </div>

        {activeTab === "details" && (
          <CD_DiscountDetailsTab 
            selectedCustomer={props.selectedCustomer}
            editingDiscountId={props.editingDiscountId}
            setEditingDiscountId={props.setEditingDiscountId}
            editDiscountName={props.editDiscountName}
            setEditDiscountName={props.setEditDiscountName}
            editDiscountType={props.editDiscountType}
            setEditDiscountType={props.setEditDiscountType}
            editDiscountValue={props.editDiscountValue}
            setEditDiscountValue={props.setEditDiscountValue}
            saveEditDiscount={props.saveEditDiscount}
            cancelEditDiscount={props.cancelEditDiscount}
            handleDeleteDiscount={props.handleDeleteDiscount}
            isSubmitting={props.isSubmitting}
            startEditDiscount={props.startEditDiscount}
          />
        )}
        
        {activeTab === "pending" && (
          <CD_PendingMonthsTab 
            pendingSettlements={props.pendingSettlements}
            selectedCustomer={props.selectedCustomer}
            getMonthName={props.getMonthName}
            handleSettle={props.handleSettle}
          />
        )}
        
        {activeTab === "settled" && (
          <CD_SettledMonthsTab 
            settledSettlements={props.settledSettlements}
            selectedCustomer={props.selectedCustomer}
            getMonthName={props.getMonthName}
            handleUnsettle={props.handleUnsettle}
            openConfirm={props.openConfirm}
          />
        )}

      </div>
    </div>
  );
}
