import React from "react";
import { ArrowLeft, User, Clock, CheckCircle, CircleDashed } from "lucide-react";
import CD_DiscountDetailsTab from "./CD_DiscountDetailsTab";
import CD_PendingMonthsTab from "./CD_PendingMonthsTab";
import CD_SemiSettledMonthsTab from "./CD_SemiSettledMonthsTab";
import CD_SettledMonthsTab from "./CD_SettledMonthsTab";
import { MonthGroup, CustomerView } from "../page";

type Discount = {
  id: string;
  customerId: string;
  name: string;
  type: string;
  value: number;
  settlementType: string;
};

export type CustomerDetailsTab = "details" | "pending" | "semi" | "settled";

interface CustomerDetailsProps {
  selectedCustomer: CustomerView;
  activeTab: CustomerDetailsTab;
  setActiveTab: (tab: CustomerDetailsTab) => void;
  setCurrentView: (view: "grid" | "add" | "details") => void;
  setSelectedCustomer: (c: null) => void;
  pendingMonthGroups: MonthGroup[];
  semiSettledMonthGroups: MonthGroup[];
  settledMonthGroups: MonthGroup[];
  getMonthName: (m: number) => string;
  handleSettle: (ids: string[]) => void;
  handleUnsettle: (ids: string[]) => void;
  openConfirm: (options: {
    title: string;
    message: string;
    confirmText: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => void;

  editingDiscountId: string | null;
  setEditingDiscountId: (id: string | null) => void;
  editDiscountName: string;
  setEditDiscountName: (v: string) => void;
  editDiscountType: "percentage" | "fixed_amount";
  setEditDiscountType: (v: "percentage" | "fixed_amount") => void;
  editDiscountValue: string;
  setEditDiscountValue: (v: string) => void;
  handleUpdateSettlementType: (customerId: string, newType: "monthly" | "with_payment") => void;
  saveEditDiscount: () => void;
  cancelEditDiscount: () => void;
  handleDeleteDiscount: (id: string) => void;
  isSubmitting: boolean;
  startEditDiscount: (d: Discount) => void;

  customersWithEmails: Map<string, string>;
  downloadTaxRebateEml: (customerId: string, customerName: string) => void;
}

export default function CustomerDetails(props: CustomerDetailsProps) {
  const {
    selectedCustomer,
    activeTab,
    setActiveTab,
    setCurrentView,
    setSelectedCustomer,
    handleUpdateSettlementType,
  } = props;

  const tabClass = (tab: CustomerDetailsTab) =>
    `flex-1 min-w-[130px] py-3.5 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
      activeTab === tab
        ? "bg-white text-gray-900 shadow-sm border border-gray-100"
        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50"
    }`;

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
                <h2 className="text-3xl font-black text-gray-900 leading-tight">
                  {selectedCustomer.customerName}
                </h2>
                <p className="text-gray-500 font-medium">{selectedCustomer.city}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 p-1.5 bg-gray-50 rounded-2xl border border-gray-200 overflow-x-auto w-full max-w-full custom-scrollbar">
            <button onClick={() => setActiveTab("details")} className={tabClass("details")}>
              <User className="w-4 h-4 shrink-0" />
              <span className="truncate">Discount Details</span>
            </button>

            <button onClick={() => setActiveTab("pending")} className={tabClass("pending")}>
              <Clock className="w-4 h-4 shrink-0" />
              <span className="truncate">Pending</span>
            </button>

            <button onClick={() => setActiveTab("semi")} className={tabClass("semi")}>
              <CircleDashed className="w-4 h-4 shrink-0" />
              <span className="truncate">Semi Settled</span>
            </button>

            <button onClick={() => setActiveTab("settled")} className={tabClass("settled")}>
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">Settled</span>
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
            handleUpdateSettlementType={handleUpdateSettlementType}
            saveEditDiscount={props.saveEditDiscount}
            cancelEditDiscount={props.cancelEditDiscount}
            handleDeleteDiscount={props.handleDeleteDiscount}
            isSubmitting={props.isSubmitting}
            startEditDiscount={props.startEditDiscount}
          />
        )}

        {activeTab === "pending" && (
          <CD_PendingMonthsTab
            pendingMonthGroups={props.pendingMonthGroups}
            getMonthName={props.getMonthName}
            handleSettle={props.handleSettle}
          />
        )}

        {activeTab === "semi" && (
          <CD_SemiSettledMonthsTab
            semiSettledMonthGroups={props.semiSettledMonthGroups}
            getMonthName={props.getMonthName}
            handleSettle={props.handleSettle}
            handleUnsettle={props.handleUnsettle}
            openConfirm={props.openConfirm}
          />
        )}

        {activeTab === "settled" && (
          <CD_SettledMonthsTab
            settledMonthGroups={props.settledMonthGroups}
            getMonthName={props.getMonthName}
            handleUnsettle={props.handleUnsettle}
            openConfirm={props.openConfirm}
          />
        )}
      </div>
    </div>
  );
}
