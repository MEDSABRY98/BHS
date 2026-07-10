"use client";
import React, { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import { bhs_supabase, fetchAllData } from "@/lib/supabase";
import Sidebar from "./Sidebar";
import ConfirmModal from "./ConfirmModal";
import CustomersList from "./CustomersList";
import AddDiscount from "./AddDiscount";
import CustomerDetails from "./CustomerDiscountsDetails/CustomerDetails";
import MonthsOverview from "./MonthsOverview";

type Discount = {
  id: string;
  customerId: string;
  name: string;
  type: string;
  value: number;
};

type Settlement = {
  id: string;
  customerId: string;
  month: number;
  year: number;
  status: string; // "Pending" or "Settled"
  notes: string;
};

export type MonthGroup = {
  key: string;
  month: number;
  year: number;
  totalCount: number;
  settledCount: number;
  pendingCount: number;
  pendingIds: string[];
  settledIds: string[];
};

export type CustomerView = {
  customerId: string;
  customerName: string;
  city: string;
  discounts: Discount[];
};

type AllCustomerItem = {
  id: string;
  name: string;
};

export default function CustomerDiscountsPage() {
  // Navigation State
  const [currentView, setCurrentView] = useState<"grid" | "add" | "details" | "months">("grid");
  
  // Data State
  const [customers, setCustomers] = useState<CustomerView[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerView[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Details View State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerView | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "pending" | "settled">("details");
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  
  // Add Form State
  const [allCustomers, setAllCustomers] = useState<AllCustomerItem[]>([]);
  const [filteredAllCustomers, setFilteredAllCustomers] = useState<AllCustomerItem[]>([]);
  const [loadingAllCustomers, setLoadingAllCustomers] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  
  // Sidebar UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [selectedAddCustomerId, setSelectedAddCustomerId] = useState<string>("");
  const [discountName, setDiscountName] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">("fixed_amount");
  const [discountValue, setDiscountValue] = useState<string>("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState("");
  
  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{show: boolean, message: string}>({ show: false, message: "" });
  
  const showToast = (message: string) => {
    setToastMessage({ show: true, message });
    setTimeout(() => {
      setToastMessage(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Edit State
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [editDiscountName, setEditDiscountName] = useState("");
  const [editDiscountType, setEditDiscountType] = useState<"percentage" | "fixed_amount">("fixed_amount");
  const [editDiscountValue, setEditDiscountValue] = useState("");

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const openConfirm = (options: { title: string; message: string; onConfirm: () => void; confirmText?: string; cancelText?: string; isDestructive?: boolean }) => {
    setConfirmModal({ ...options, isOpen: true });
  };

  const closeConfirm = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    fetchCustomersAndDiscounts();
  }, []);

  // Filter customers in Grid view
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
    } else {
      const lowerQ = searchQuery.toLowerCase();
      setFilteredCustomers(
        customers.filter(c => 
          c.customerName.toLowerCase().includes(lowerQ) || 
          c.customerId.toLowerCase().includes(lowerQ)
        )
      );
    }
  }, [searchQuery, customers]);

  // Load all customers for Add form when view is "add"
  useEffect(() => {
    if (currentView === "add" && allCustomers.length === 0) {
      fetchAllCustomersForAdd();
    }
  }, [currentView]);

  // Filter all customers for Add form dropdown
  useEffect(() => {
    if (addSearch.trim() === "") {
      setFilteredAllCustomers(allCustomers.slice(0, 50));
    } else {
      const lowerSearch = addSearch.toLowerCase();
      setFilteredAllCustomers(
        allCustomers.filter(c => c.name.toLowerCase().includes(lowerSearch)).slice(0, 50)
      );
    }
  }, [addSearch, allCustomers]);

  const fetchAllCustomersForAdd = async () => {
    try {
      setLoadingAllCustomers(true);
      const data = await fetchAllData(() =>
        bhs_supabase.from("bhs_CUSTOMERS").select('"CUSTOMER ID", "CUSTOMER MAIN NAME"')
      );
      
      const uniqueMap = new Map<string, AllCustomerItem>();

      data.forEach((d: any) => {
        const id = d["CUSTOMER ID"]?.toString().trim();
        const name = d["CUSTOMER MAIN NAME"]?.toString().trim();
        if (id && name && !uniqueMap.has(name)) {
          uniqueMap.set(name, { id, name });
        }
      });
      
      const mapped: AllCustomerItem[] = Array.from(uniqueMap.values());
      mapped.sort((a, b) => a.name.localeCompare(b.name));
        
      setAllCustomers(mapped);
      setFilteredAllCustomers(mapped.slice(0, 50));
    } catch (err) {
      console.error("Error fetching all customers:", err);
    } finally {
      setLoadingAllCustomers(false);
    }
  };

  const fetchCustomersAndDiscounts = async () => {
    try {
      setLoading(true);
      // Fetch discounts
      const discountsData = await fetchAllData(() =>
        bhs_supabase.from("web_CUSTOMERS_DISCOUNTS").select("*")
      );

      // Group discounts by customer ID
      const discountsByCustomer: Record<string, Discount[]> = {};
      discountsData.forEach((d: any) => {
        const cId = d.CUSTOMER_ID;
        if (!discountsByCustomer[cId]) discountsByCustomer[cId] = [];
        discountsByCustomer[cId].push({
          id: d.ID,
          customerId: cId,
          name: d.DISCOUNT_NAME,
          type: d.DISCOUNT_TYPE,
          value: Number(d.DISCOUNT_VALUE) || 0,
        });
      });

      const customerIds = Object.keys(discountsByCustomer);

      if (customerIds.length === 0) {
        setCustomers([]);
        setFilteredCustomers([]);
        return;
      }

      // Fetch customer details from bhs_CUSTOMERS
      const customersData = await fetchAllData(() =>
        bhs_supabase.from("bhs_CUSTOMERS").select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER CITY"')
      );

      const customerNameMap = new Map<string, string>();
      const customerCityMap = new Map<string, string>();
      
      customersData.forEach((row: any) => {
        const id = row["CUSTOMER ID"]?.toString().trim();
        const name = row["CUSTOMER MAIN NAME"]?.toString().trim();
        const city = row["CUSTOMER CITY"]?.toString().trim();
        if (id) {
          if (name) customerNameMap.set(id, name);
          if (city) customerCityMap.set(id, city);
        }
      });

      const finalCustomers: CustomerView[] = customerIds.map((cId) => ({
        customerId: cId,
        customerName: customerNameMap.get(cId) || cId,
        city: customerCityMap.get(cId) || "Unknown",
        discounts: discountsByCustomer[cId],
      }));

      // Sort alphabetically
      finalCustomers.sort((a, b) => a.customerName.localeCompare(b.customerName));
      setCustomers(finalCustomers);
      
      // If a customer was already selected, update it
      if (selectedCustomer) {
        const updatedCustomer = finalCustomers.find(c => c.customerId === selectedCustomer.customerId);
        if (updatedCustomer) {
          setSelectedCustomer(updatedCustomer);
        } else {
          // Customer has no discounts left
          setSelectedCustomer(null);
          setCurrentView("grid");
        }
      }
    } catch (error) {
      console.error("Error fetching customers and discounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = async (customer: CustomerView) => {
    setSelectedCustomer(customer);
    setActiveTab("details");
    setCurrentView("details");
    await loadSettlements(customer.customerId);
  };

  const loadSettlements = async (customerId: string) => {
    try {
      setLoadingSettlements(true);
      const data = await fetchAllData(() =>
        bhs_supabase
          .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
          .select("*")
          .eq("CUSTOMER_ID", customerId)
      );

      const mappedData: Settlement[] = data.map((d: any) => ({
        id: d.ID,
        customerId: d.CUSTOMER_ID,
        month: d.MONTH,
        year: d.YEAR,
        status: d.STATUS,
        notes: d.NOTES,
      }));

      // Sort by year then month
      mappedData.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      setSettlements(mappedData);
    } catch (error) {
      console.error("Error loading settlements:", error);
    } finally {
      setLoadingSettlements(false);
    }
  };

  const handleSettle = async (settlementIds: string[]) => {
    try {
      const { error } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
        .update({ STATUS: "Settled" })
        .in("ID", settlementIds);

      if (error) throw error;

      // Optimistic update
      setSettlements((prev) =>
        prev.map((s) => (settlementIds.includes(s.id) ? { ...s, status: "Settled" } : s))
      );
    } catch (error) {
      console.error("Error settling month:", error);
      alert("An error occurred during settlement.");
    }
  };

  const handleUnsettle = async (settlementIds: string[]) => {
    try {
      const { error } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
        .update({ STATUS: "Pending" })
        .in("ID", settlementIds);

      if (error) throw error;

      // Optimistic update
      setSettlements((prev) =>
        prev.map((s) => (settlementIds.includes(s.id) ? { ...s, status: "Pending" } : s))
      );
    } catch (error) {
      console.error("Error unsettling month:", error);
      alert("An error occurred during unsettle action.");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");

    if (!selectedAddCustomerId) {
      setAddError("Please select a customer.");
      return;
    }
    if (!discountName.trim()) {
      setAddError("Please enter a discount/rent name.");
      return;
    }
    if (!discountValue || isNaN(Number(discountValue)) || Number(discountValue) <= 0) {
      setAddError("Please enter a valid positive value.");
      return;
    }

    try {
      setIsSubmitting(true);
      const discountId = `D-${Date.now()}`;
      
      // Insert discount
      const { error: discountError } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS")
        .insert({
          ID: discountId,
          CUSTOMER_ID: selectedAddCustomerId,
          DISCOUNT_NAME: discountName,
          DISCOUNT_TYPE: discountType,
          DISCOUNT_VALUE: Number(discountValue),
        });

      if (discountError) throw discountError;

      // Generate 12 months for 2026
      const year = 2026;
      const newSettlements = [];
      for (let month = 1; month <= 12; month++) {
        newSettlements.push({
          ID: `S-${discountId}-${month}`,
          CUSTOMER_ID: selectedAddCustomerId,
          MONTH: month,
          YEAR: year,
          STATUS: "Pending",
          NOTES: "",
        });
      }

      const { error: settlementsError } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
        .insert(newSettlements);

      if (settlementsError) throw settlementsError;

      // Success
      setDiscountName("");
      setDiscountValue("");
      // Keep selectedAddCustomerId and addSearch so they can add another discount for the same customer easily
      
      await fetchCustomersAndDiscounts();
      
      // Show a quick success alert or just let the empty fields indicate success
      showToast("Config added successfully!");

    } catch (err: any) {
      console.error("Error saving discount:", err);
      setAddError(err.message || "An error occurred while saving.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit & Delete handlers
  const handleDeleteDiscount = async (discountId: string) => {
    openConfirm({
      title: "Delete Configuration",
      message: "Are you sure you want to delete this config and all its pending/settled months? This action cannot be undone.",
      confirmText: "Delete",
      isDestructive: true,
      onConfirm: async () => {
        try {
          // Delete settlements first
          await bhs_supabase
            .from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS")
            .delete()
            .like("ID", `S-${discountId}-%`);

          // Delete discount
          await bhs_supabase
            .from("web_CUSTOMERS_DISCOUNTS")
            .delete()
            .eq("ID", discountId);

          await fetchCustomersAndDiscounts();
        } catch (err) {
          console.error("Error deleting discount:", err);
          alert("An error occurred while deleting.");
        }
      }
    });
  };

  const startEditDiscount = (d: Discount) => {
    setEditingDiscountId(d.id);
    setEditDiscountName(d.name);
    setEditDiscountType(d.type as any);
    setEditDiscountValue(d.value.toString());
  };

  const cancelEditDiscount = () => {
    setEditingDiscountId(null);
  };

  const saveEditDiscount = async () => {
    if (!editingDiscountId) return;
    if (!editDiscountName.trim() || !editDiscountValue || isNaN(Number(editDiscountValue)) || Number(editDiscountValue) <= 0) {
      alert("Please provide valid inputs.");
      return;
    }

    try {
      setIsSubmitting(true);
      const { error } = await bhs_supabase
        .from("web_CUSTOMERS_DISCOUNTS")
        .update({
          DISCOUNT_NAME: editDiscountName,
          DISCOUNT_TYPE: editDiscountType,
          DISCOUNT_VALUE: Number(editDiscountValue),
        })
        .eq("ID", editingDiscountId);

      if (error) throw error;
      
      setEditingDiscountId(null);
      await fetchCustomersAndDiscounts();
    } catch (err) {
      console.error("Error updating discount:", err);
      alert("Error updating discount.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derived filtered settlements up to current month
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const visibleSettlements = settlements.filter((s) => {
    if (s.year < currentYear) return true;
    if (s.year === currentYear && s.month <= currentMonth) return true;
    return false;
  });

  const groupedMonthsMap = new Map<string, MonthGroup>();
  visibleSettlements.forEach(s => {
    const key = `${s.year}-${s.month}`;
    if (!groupedMonthsMap.has(key)) {
      groupedMonthsMap.set(key, {
        key, month: s.month, year: s.year, totalCount: 0, settledCount: 0, pendingCount: 0, pendingIds: [], settledIds: []
      });
    }
    const group = groupedMonthsMap.get(key)!;
    group.totalCount++;
    if (s.status === "Settled") {
      group.settledCount++;
      group.settledIds.push(s.id);
    } else {
      group.pendingCount++;
      group.pendingIds.push(s.id);
    }
  });

  const allMonthGroups = Array.from(groupedMonthsMap.values()).sort((a, b) => {
     if (a.year !== b.year) return a.year - b.year;
     return a.month - b.month;
  });

  const pendingMonthGroups = allMonthGroups.filter(g => g.pendingCount > 0);
  const settledMonthGroups = allMonthGroups.filter(g => g.pendingCount === 0 && g.totalCount > 0);

  // Format month to English name
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const getMonthName = (m: number) => monthNames[m - 1] || m.toString();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        currentView={currentView}
        setCurrentView={setCurrentView}
        setSelectedCustomer={setSelectedCustomer}
      />

      {/* Main Workspace Area (Right) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-gray-50">
        


        {currentView === "grid" && (
          <CustomersList 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            loading={loading}
            filteredCustomers={filteredCustomers}
            handleSelectCustomer={handleSelectCustomer}
          />
        )}

        {currentView === "add" && (
          <AddDiscount 
            handleAddSubmit={handleAddSubmit}
            addError={addError}
            loadingAllCustomers={loadingAllCustomers}
            addSearch={addSearch}
            setAddSearch={setAddSearch}
            filteredAllCustomers={filteredAllCustomers}
            selectedAddCustomerId={selectedAddCustomerId}
            setSelectedAddCustomerId={setSelectedAddCustomerId}
            discountName={discountName}
            setDiscountName={setDiscountName}
            discountType={discountType}
            setDiscountType={setDiscountType}
            discountValue={discountValue}
            setDiscountValue={setDiscountValue}
            isSubmitting={isSubmitting}
          />
        )}

        {currentView === "details" && selectedCustomer && (
          <CustomerDetails 
            selectedCustomer={selectedCustomer}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setCurrentView={setCurrentView}
            setSelectedCustomer={setSelectedCustomer}
            pendingMonthGroups={pendingMonthGroups}
            settledMonthGroups={settledMonthGroups}
            getMonthName={getMonthName}
            handleSettle={handleSettle}
            handleUnsettle={handleUnsettle}
            openConfirm={openConfirm}
            editingDiscountId={editingDiscountId}
            setEditingDiscountId={setEditingDiscountId}
            editDiscountName={editDiscountName}
            setEditDiscountName={setEditDiscountName}
            editDiscountType={editDiscountType}
            setEditDiscountType={setEditDiscountType}
            editDiscountValue={editDiscountValue}
            setEditDiscountValue={setEditDiscountValue}
            saveEditDiscount={saveEditDiscount}
            cancelEditDiscount={cancelEditDiscount}
            handleDeleteDiscount={handleDeleteDiscount}
            isSubmitting={isSubmitting}
            startEditDiscount={startEditDiscount}
          />
        )}
        
        {currentView === "months" && (
          <MonthsOverview 
            customers={customers}
            handleSelectCustomer={handleSelectCustomer}
          />
        )}

      </div>

      <ConfirmModal 
        modal={confirmModal}
        closeConfirm={closeConfirm}
      />
      
      {/* Toast Notification */}
      <div className={`fixed bottom-8 right-8 z-50 transition-all duration-300 transform ${toastMessage.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="bg-white border-l-4 border-l-green-500 shadow-xl rounded-2xl p-4 flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-full">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="font-bold text-gray-800">{toastMessage.message}</p>
        </div>
      </div>
    </div>
  );
}
