import React, { useMemo } from "react";
import { CustomerView } from "./page";
import { BarChart3, Percent, Building2, Users, MapPin, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";

interface StatisticsProps {
  customers: CustomerView[];
}

export default function Statistics({ customers }: StatisticsProps) {
  
  const stats = useMemo(() => {
    let rebateOnlyCount = 0;
    let rentOnlyCount = 0;
    let bothCount = 0;
    
    let allRebates: number[] = [];
    let allRents: number[] = [];
    
    const cityMap = new Map<string, { total: number, rebate: number, rent: number, totalRebate: number, totalRent: number }>();

    customers.forEach(c => {
      let hasRebate = false;
      let hasRent = false;
      let customerRebate = 0;
      let customerRent = 0;

      c.discounts.forEach(d => {
        const val = Number(d.value);
        if (d.type === "percentage") {
          hasRebate = true;
          if (val > 0) {
             allRebates.push(val);
             customerRebate += val;
          }
        } else {
          hasRent = true;
          if (val > 0) {
             allRents.push(val);
             customerRent += val;
          }
        }
      });

      if (hasRebate && !hasRent) rebateOnlyCount++;
      else if (!hasRebate && hasRent) rentOnlyCount++;
      else if (hasRebate && hasRent) bothCount++;

      // City Grouping
      const city = c.city || "Unknown City";
      if (!cityMap.has(city)) {
        cityMap.set(city, { total: 0, rebate: 0, rent: 0, totalRebate: 0, totalRent: 0 });
      }
      const cityStats = cityMap.get(city)!;
      cityStats.total++;
      if (hasRebate) cityStats.rebate++;
      if (hasRent) cityStats.rent++;
      cityStats.totalRebate += customerRebate;
      cityStats.totalRent += customerRent;
    });

    const avgRebate = allRebates.length > 0 ? allRebates.reduce((a,b)=>a+b, 0) / allRebates.length : 0;
    const minRebate = allRebates.length > 0 ? Math.min(...allRebates) : 0;
    const maxRebate = allRebates.length > 0 ? Math.max(...allRebates) : 0;

    const avgRent = allRents.length > 0 ? allRents.reduce((a,b)=>a+b, 0) / allRents.length : 0;
    const minRent = allRents.length > 0 ? Math.min(...allRents) : 0;
    const maxRent = allRents.length > 0 ? Math.max(...allRents) : 0;

    const cityArray = Array.from(cityMap.entries()).map(([cityName, data]) => ({
      cityName,
      ...data
    })).sort((a, b) => b.total - a.total); // Sort by total customers descending

    return {
      total: customers.length,
      rebateOnlyCount,
      rentOnlyCount,
      bothCount,
      avgRebate, minRebate, maxRebate,
      avgRent, minRent, maxRent,
      cityArray
    };
  }, [customers]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 animate-in fade-in duration-300">
       <div className="max-w-7xl mx-auto space-y-8">
         
         {/* Header */}
         <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-[#D4AF37]/10 p-3 rounded-2xl">
              <BarChart3 className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900">Statistics & Insights</h2>
            </div>
         </div>

         {/* Top Summary Cards */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-4 text-gray-500">
                <Users className="w-5 h-5" />
                <span className="font-bold">Total Customers</span>
              </div>
              <p className="text-4xl font-black text-gray-900">{stats.total}</p>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute right-0 top-0 bg-blue-50 w-24 h-24 rounded-bl-full -z-0" />
              <div className="flex items-center gap-3 mb-4 text-blue-600 z-10">
                <Percent className="w-5 h-5" />
                <span className="font-bold">Rebate Only</span>
              </div>
              <p className="text-4xl font-black text-gray-900 z-10">{stats.rebateOnlyCount}</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-purple-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute right-0 top-0 bg-purple-50 w-24 h-24 rounded-bl-full -z-0" />
              <div className="flex items-center gap-3 mb-4 text-purple-600 z-10">
                <Building2 className="w-5 h-5" />
                <span className="font-bold">Rent Only</span>
              </div>
              <p className="text-4xl font-black text-gray-900 z-10">{stats.rentOnlyCount}</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-[#D4AF37]/20 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute right-0 top-0 bg-[#D4AF37]/10 w-24 h-24 rounded-bl-full -z-0" />
              <div className="flex items-center gap-3 mb-4 text-[#C5A030] z-10">
                <Activity className="w-5 h-5" />
                <span className="font-bold">Both (Rebate & Rent)</span>
              </div>
              <p className="text-4xl font-black text-gray-900 z-10">{stats.bothCount}</p>
            </div>
         </div>

         {/* Detailed Stats Row */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           
           {/* Rebate Stats */}
           <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
             <div className="flex items-center gap-3 mb-8">
               <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
                 <Percent className="w-6 h-6" />
               </div>
               <h3 className="text-2xl font-bold text-gray-900">Rebate Analysis</h3>
             </div>

             <div className="grid grid-cols-3 gap-4">
               <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                 <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Average</p>
                 <p className="text-2xl font-black text-gray-900">{stats.avgRebate.toFixed(1)}%</p>
               </div>
               <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                 <div className="flex justify-center items-center gap-1 text-red-600 mb-2">
                   <ArrowDownRight className="w-4 h-4" />
                   <p className="text-xs font-bold uppercase tracking-wider">Lowest</p>
                 </div>
                 <p className="text-2xl font-black text-red-700">{stats.minRebate}%</p>
               </div>
               <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                 <div className="flex justify-center items-center gap-1 text-green-600 mb-2">
                   <ArrowUpRight className="w-4 h-4" />
                   <p className="text-xs font-bold uppercase tracking-wider">Highest</p>
                 </div>
                 <p className="text-2xl font-black text-green-700">{stats.maxRebate}%</p>
               </div>
             </div>
           </div>

           {/* Rent Stats */}
           <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
             <div className="flex items-center gap-3 mb-8">
               <div className="bg-purple-100 p-3 rounded-2xl text-purple-600">
                 <Building2 className="w-6 h-6" />
               </div>
               <h3 className="text-2xl font-bold text-gray-900">Rent Analysis</h3>
             </div>

             <div className="grid grid-cols-3 gap-4">
               <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                 <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Average</p>
                 <p className="text-xl md:text-2xl font-black text-gray-900">{stats.avgRent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                 <p className="text-[10px] text-gray-400 font-bold mt-1">AED</p>
               </div>
               <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                 <div className="flex justify-center items-center gap-1 text-red-600 mb-2">
                   <ArrowDownRight className="w-4 h-4" />
                   <p className="text-xs font-bold uppercase tracking-wider">Lowest</p>
                 </div>
                 <p className="text-xl md:text-2xl font-black text-red-700">{stats.minRent.toLocaleString()}</p>
                 <p className="text-[10px] text-red-400 font-bold mt-1">AED</p>
               </div>
               <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                 <div className="flex justify-center items-center gap-1 text-green-600 mb-2">
                   <ArrowUpRight className="w-4 h-4" />
                   <p className="text-xs font-bold uppercase tracking-wider">Highest</p>
                 </div>
                 <p className="text-xl md:text-2xl font-black text-green-700">{stats.maxRent.toLocaleString()}</p>
                 <p className="text-[10px] text-green-500 font-bold mt-1">AED</p>
               </div>
             </div>
           </div>

         </div>

         {/* City Breakdown Table */}
         <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-8">
            <div className="p-6 md:p-8 border-b border-gray-100 flex items-center gap-3">
              <div className="bg-gray-100 p-3 rounded-2xl text-gray-700">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">City Distribution</h3>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-8 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">City Name</th>
                    <th className="px-8 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Total Customers</th>
                    <th className="px-8 py-4 text-xs font-bold text-blue-600 uppercase tracking-wider text-center">With Rebate</th>
                    <th className="px-8 py-4 text-xs font-bold text-blue-600 uppercase tracking-wider text-center">Total Rebates</th>
                    <th className="px-8 py-4 text-xs font-bold text-purple-600 uppercase tracking-wider text-center">With Rent</th>
                    <th className="px-8 py-4 text-xs font-bold text-purple-600 uppercase tracking-wider text-center">Total Rent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.cityArray.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-8 py-12 text-center text-gray-500 font-medium">No city data available.</td>
                    </tr>
                  ) : (
                    <>
                      {stats.cityArray.map((city, index) => (
                        <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-8 py-5 text-center">
                            <span className="font-bold text-gray-900">{city.cityName}</span>
                          </td>
                          <td className="px-8 py-5 text-center">
                            <span className="inline-flex items-center justify-center bg-gray-100 text-gray-800 font-bold px-3 py-1 rounded-full text-sm">
                              {city.total}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-center">
                            {city.rebate > 0 ? (
                              <span className="font-bold text-blue-600">{city.rebate}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-8 py-5 text-center">
                            {city.totalRebate > 0 ? (
                              <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">{city.totalRebate}%</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-8 py-5 text-center">
                            {city.rent > 0 ? (
                              <span className="font-bold text-purple-600">{city.rent}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-8 py-5 text-center">
                            {city.totalRent > 0 ? (
                              <span className="font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md">{city.totalRent.toLocaleString()} AED</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {/* Grand Total Row */}
                      <tr className="bg-gray-900 border-t border-gray-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <td className="px-8 py-5 text-center">
                          <span className="font-black text-white text-lg">TOTAL</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="inline-flex items-center justify-center bg-white/20 text-white font-black px-3 py-1 rounded-full text-sm">
                            {stats.total}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="font-black text-blue-300">{stats.rebateOnlyCount + stats.bothCount}</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="font-black text-white bg-blue-500/30 px-2.5 py-1 rounded-md">
                            {stats.cityArray.reduce((acc, c) => acc + c.totalRebate, 0)}%
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="font-black text-purple-300">{stats.rentOnlyCount + stats.bothCount}</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="font-black text-white bg-purple-500/30 px-2.5 py-1 rounded-md">
                            {stats.cityArray.reduce((acc, c) => acc + c.totalRent, 0).toLocaleString()} AED
                          </span>
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
         </div>

       </div>
    </div>
  );
}
