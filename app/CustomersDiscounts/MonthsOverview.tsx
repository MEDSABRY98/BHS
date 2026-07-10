import React, { useState, useEffect, useMemo } from "react";
import { fetchAllData, bhs_supabase } from "@/lib/supabase";
import { Loader2, Clock, CheckCircle, Search, ArrowLeft, Calendar as CalendarIcon, User } from "lucide-react";
import { CustomerView } from "./page";

type Settlement = {
  id: string;
  customerId: string;
  month: number;
  year: number;
  status: string;
};

interface MonthsOverviewProps {
  customers: CustomerView[];
  handleSelectCustomer: (customer: CustomerView) => void;
}

export default function MonthsOverview({ customers, handleSelectCustomer }: MonthsOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [allSettlements, setAllSettlements] = useState<Settlement[]>([]);
  
  // Drill-down State
  const [selectedMonthGroup, setSelectedMonthGroup] = useState<{ year: number; month: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "settled">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
    const fetchSettlements = async () => {
      try {
        setLoading(true);
        const data = await fetchAllData(() => 
          bhs_supabase.from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS").select("ID, CUSTOMER_ID, MONTH, YEAR, STATUS")
        );
        const mapped = data.map((d: any) => ({
          id: d.ID,
          customerId: d.CUSTOMER_ID,
          month: Number(d.MONTH),
          year: Number(d.YEAR),
          status: d.STATUS || "Pending",
        }));
        setAllSettlements(mapped);
      } catch (err) {
        console.error("Error fetching settlements overview:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettlements();
  }, []);

  // Compute stats for all months
  const monthStatsMap = useMemo(() => {
    const map = new Map<string, { year: number, month: number, total: number, pending: number, settled: number }>();
    
    // To ensure all 12 months for current year appear even if empty, we can pre-fill them
    const currentYear = new Date().getFullYear();
    for(let m=1; m<=12; m++) {
      map.set(`${currentYear}-${m}`, { year: currentYear, month: m, total: 0, pending: 0, settled: 0 });
    }

    allSettlements.forEach(s => {
      const key = `${s.year}-${s.month}`;
      if (!map.has(key)) {
        map.set(key, { year: s.year, month: s.month, total: 0, pending: 0, settled: 0 });
      }
      const st = map.get(key)!;
      st.total++;
      if (s.status === "Settled") st.settled++;
      else st.pending++;
    });

    const arr = Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    return arr;
  }, [allSettlements]);

  // Filtered Months (Grid view)
  const filteredMonths = useMemo(() => {
    return monthStatsMap.filter(m => {
      const mName = monthNames[m.month - 1].toLowerCase();
      const s = searchQuery.toLowerCase();
      return mName.includes(s) || m.year.toString().includes(s);
    });
  }, [monthStatsMap, searchQuery]);

  // Drill-down data for a selected month
  const { pendingCustomers, collectedCustomers } = useMemo(() => {
    if (!selectedMonthGroup) return { pendingCustomers: [], collectedCustomers: [] };
    
    const monthSettlements = allSettlements.filter(s => s.year === selectedMonthGroup.year && s.month === selectedMonthGroup.month);
    
    // Group by customerId
    const customerMap = new Map<string, { pending: number; total: number }>();
    monthSettlements.forEach(s => {
      if (!customerMap.has(s.customerId)) {
        customerMap.set(s.customerId, { pending: 0, total: 0 });
      }
      const c = customerMap.get(s.customerId)!;
      c.total++;
      if (s.status !== "Settled") c.pending++;
    });

    const pending: { customer: CustomerView, stats: { pending: number, total: number } }[] = [];
    const collected: { customer: CustomerView, stats: { pending: number, total: number } }[] = [];

    customerMap.forEach((stats, cId) => {
      const cust = customers.find(c => c.customerId === cId);
      if (cust) {
        if (stats.pending > 0) pending.push({ customer: cust, stats });
        else collected.push({ customer: cust, stats });
      }
    });

    pending.sort((a, b) => a.customer.customerName.localeCompare(b.customer.customerName));
    collected.sort((a, b) => a.customer.customerName.localeCompare(b.customer.customerName));

    return { pendingCustomers: pending, collectedCustomers: collected };
  }, [allSettlements, selectedMonthGroup, customers]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 animate-in fade-in duration-300">
         <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Skeleton */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-200 w-12 h-12 rounded-2xl" />
                  <div className="bg-gray-200 w-48 h-8 rounded-lg" />
                </div>
                <div className="bg-gray-200 w-full sm:w-96 h-12 rounded-2xl" />
            </div>
            
            {/* Grid Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-white border-t-4 border-t-gray-200 rounded-3xl p-6 shadow-sm flex flex-col animate-pulse min-h-[220px]">
                     <div className="bg-gray-200 w-32 h-8 rounded-lg mb-2" />
                     <div className="bg-gray-200 w-16 h-5 rounded-lg mb-8" />
                     <div className="space-y-3 mt-auto w-full">
                       <div className="bg-gray-100 w-full h-10 rounded-xl" />
                       <div className="bg-gray-100 w-full h-10 rounded-xl" />
                     </div>
                  </div>
                ))}
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 animate-in fade-in duration-300">
       <div className="max-w-7xl mx-auto space-y-8">
         
         {!selectedMonthGroup ? (
           // --- VIEW 1: GRID OF MONTHS ---
           <>
             {/* Header & Search */}
             <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="bg-[#D4AF37]/10 p-3 rounded-2xl">
                    <CalendarIcon className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Monthly Overview</h2>
                </div>

                <div className="relative w-full sm:w-96">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by month or year..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all font-medium text-gray-900 placeholder-gray-400"
                  />
                </div>
             </div>

             {/* Months Grid */}
             {filteredMonths.length === 0 ? (
                <div className="text-center p-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-gray-500 font-bold text-lg">No months found matching your search.</p>
                </div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                 {filteredMonths.map(m => {
                   const mName = monthNames[m.month - 1];
                   return (
                     <button
                       key={`${m.year}-${m.month}`}
                       onClick={() => {
                         setSelectedMonthGroup({ year: m.year, month: m.month });
                         setActiveTab("pending"); // default to pending tab
                       }}
                       className="bg-white border-t-4 border-t-gray-900 rounded-3xl p-6 shadow-sm hover:shadow-lg transition-all text-left flex flex-col group relative overflow-hidden"
                     >
                       <div className="absolute right-0 top-0 w-24 h-24 bg-gray-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110" />
                       
                       <h3 className="text-2xl font-black text-gray-900 mb-1 z-10">{mName}</h3>
                       <p className="text-gray-500 font-bold mb-6 z-10">{m.year}</p>

                       <div className="space-y-3 mt-auto z-10 w-full">
                         <div className="flex items-center justify-between bg-orange-50 px-4 py-2.5 rounded-xl border border-orange-100">
                           <span className="text-orange-700 font-bold text-sm">Pending</span>
                           <span className="bg-white text-orange-600 font-black px-2 py-0.5 rounded-md shadow-sm text-sm">{m.pending}</span>
                         </div>
                         <div className="flex items-center justify-between bg-green-50 px-4 py-2.5 rounded-xl border border-green-100">
                           <span className="text-green-700 font-bold text-sm">Settled</span>
                           <span className="bg-white text-green-600 font-black px-2 py-0.5 rounded-md shadow-sm text-sm">{m.settled}</span>
                         </div>
                       </div>
                     </button>
                   );
                 })}
               </div>
             )}
           </>
         ) : (
           // --- VIEW 2: MONTH DETAILS (TABS) ---
           <>
             {/* Header */}
             <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedMonthGroup(null)}
                    className="p-3 bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all border border-gray-200"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 leading-tight">
                      {monthNames[selectedMonthGroup.month - 1]} {selectedMonthGroup.year}
                    </h2>
                    <p className="text-gray-500 font-medium mt-1">Customers Payment Overview</p>
                  </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-2 p-1.5 bg-gray-50 rounded-2xl border border-gray-200 overflow-x-auto w-full custom-scrollbar">
                  <button
                    onClick={() => setActiveTab("pending")}
                    className={`flex-1 min-w-[150px] py-3.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                      activeTab === "pending"
                        ? "bg-white text-gray-900 shadow-sm border border-gray-100"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50"
                    }`}
                  >
                    <Clock className="w-4 h-4 shrink-0" />
                    <span className="truncate">Pending ({pendingCustomers.length})</span>
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
                    <span className="truncate">Settled ({collectedCustomers.length})</span>
                  </button>
                </div>
             </div>

             {/* Tab Content */}
             {activeTab === "pending" && (
                <div className="animate-in fade-in duration-300">
                  {pendingCustomers.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-500 font-bold text-lg">
                      No pending collections for this month.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {pendingCustomers.map((pc) => (
                        <div key={pc.customer.customerId} className="bg-white border-t-4 border-t-orange-400 p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative flex flex-col">
                           <div className="mb-4">
                             <div className="bg-[#D4AF37]/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                               <User className="w-5 h-5 text-[#D4AF37]" />
                             </div>
                             <h4 className="font-bold text-lg text-gray-900 leading-tight">{pc.customer.customerName}</h4>
                           </div>
                           
                           <div className="mt-auto">
                             <p className="text-xs text-orange-600 font-bold uppercase tracking-wider mb-4">
                               {pc.stats.total - pc.stats.pending} / {pc.stats.total} Collected
                             </p>
                             <button 
                               onClick={() => handleSelectCustomer(pc.customer)}
                               className="w-full px-4 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-black transition-colors"
                             >
                               View Details
                             </button>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
             )}

             {activeTab === "settled" && (
                <div className="animate-in fade-in duration-300">
                  {collectedCustomers.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-500 font-bold text-lg">
                      No fully collected customers for this month yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {collectedCustomers.map((cc) => (
                        <div key={cc.customer.customerId} className="bg-white border-t-4 border-t-green-500 p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative flex flex-col">
                           <div className="mb-4">
                             <div className="bg-[#D4AF37]/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                               <User className="w-5 h-5 text-[#D4AF37]" />
                             </div>
                             <h4 className="font-bold text-lg text-gray-900 leading-tight">{cc.customer.customerName}</h4>
                           </div>
                           
                           <div className="mt-auto">
                             <p className="text-xs text-green-600 font-bold uppercase tracking-wider mb-4">
                               All {cc.stats.total} Collected
                             </p>
                             <button 
                               onClick={() => handleSelectCustomer(cc.customer)}
                               className="w-full px-4 py-2.5 bg-gray-50 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"
                             >
                               View Details
                             </button>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
             )}
           </>
         )}

       </div>
    </div>
  );
}
