import React, { useMemo } from 'react';
import { BarChart3, Users, DollarSign, Activity } from 'lucide-react';

interface StatisticsReceiptTabProps {
  savedReceipts: any[];
  isFetchingSaved: boolean;
}

export default function StatisticsReceiptTab({ savedReceipts, isFetchingSaved }: StatisticsReceiptTabProps) {
  
  const stats = useMemo(() => {
    let totalAmount = 0;
    const personMap = new Map<string, { count: number; totalAmount: number }>();

    savedReceipts.forEach(receipt => {
      const amount = Number(receipt.amount) || 0;
      totalAmount += amount;
      
      const personName = receipt.receivedFrom || 'Unknown';
      if (!personMap.has(personName)) {
        personMap.set(personName, { count: 0, totalAmount: 0 });
      }
      
      const pStats = personMap.get(personName)!;
      pStats.count += 1;
      pStats.totalAmount += amount;
    });

    const personArray = Array.from(personMap.entries()).map(([name, data]) => ({
      name,
      ...data
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      totalReceipts: savedReceipts.length,
      totalAmount,
      uniquePersons: personMap.size,
      personArray
    };
  }, [savedReceipts]);

  if (isFetchingSaved && savedReceipts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4 text-gray-500">
            <Activity className="w-5 h-5" />
            <span className="font-bold">Total Receipts</span>
          </div>
          <p className="text-4xl font-black text-gray-900">{stats.totalReceipts}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 bg-blue-50 w-24 h-24 rounded-bl-full -z-0" />
          <div className="flex items-center gap-3 mb-4 text-blue-600 z-10">
            <Users className="w-5 h-5" />
            <span className="font-bold">Unique Persons</span>
          </div>
          <p className="text-4xl font-black text-gray-900 z-10">{stats.uniquePersons}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 bg-amber-50 w-24 h-24 rounded-bl-full -z-0" />
          <div className="flex items-center gap-3 mb-4 text-amber-600 z-10">
            <DollarSign className="w-5 h-5" />
            <span className="font-bold">Total Amount</span>
          </div>
          <p className="text-3xl lg:text-4xl font-black text-gray-900 z-10">
            {stats.totalAmount.toLocaleString()} <span className="text-sm text-gray-500">AED</span>
          </p>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-100">
          <h3 className="text-2xl font-bold text-gray-900">Received From Breakdown</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-8 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">#</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Received From</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Number of Receipts</th>
                <th className="px-8 py-4 text-xs font-bold text-amber-600 uppercase tracking-wider text-center">Total Amount (AED)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.personArray.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-gray-500 font-medium">No receipts data available.</td>
                </tr>
              ) : (
                stats.personArray.map((person, index) => (
                  <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-5 text-center text-gray-400 font-bold">
                      {index + 1}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="font-bold text-gray-900 text-lg">{person.name}</span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="inline-flex items-center justify-center bg-gray-100 text-gray-800 font-bold px-3 py-1 rounded-full text-sm">
                        {person.count}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg text-lg">
                        {person.totalAmount.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
