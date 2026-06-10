import { Printer, Trash2 } from 'lucide-react';
import { DailyDataRow } from '../page';
import NoData from '@/components/01-Unified/NoDataTab';

interface WaterHistoryTabProps {
  dailyData: DailyDataRow[];
  handleReprint: (deliveryNoteNumber: string) => void;
  handleDelete: (deliveryNoteNumber: string) => void;
}

export default function WaterHistoryTab({
  dailyData,
  handleReprint,
  handleDelete
}: WaterHistoryTabProps) {
  // Group transactions by deliveryNoteNumber
  const groupedTransactions = dailyData.reduce((acc, curr) => {
    if (!acc[curr.deliveryNoteNumber]) {
      acc[curr.deliveryNoteNumber] = {
        deliveryNoteNumber: curr.deliveryNoteNumber,
        date: curr.date,
        receivedBy: curr.receivedBy,
        totalQuantity: 0,
      };
    }
    acc[curr.deliveryNoteNumber].totalQuantity += curr.quantity;
    return acc;
  }, {} as Record<string, { deliveryNoteNumber: string; date: string; receivedBy: string; totalQuantity: number }>);

  const transactions = Object.values(groupedTransactions).sort((a, b) => {
    // sort descending by date, then by deliveryNoteNumber descending
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.deliveryNoteNumber.localeCompare(a.deliveryNoteNumber);
  });

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">Transaction History</h2>
      
      {transactions.length === 0 ? (
        <NoData title="NO TRANSACTIONS" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 font-semibold text-gray-700 text-center">Transaction ID</th>
                <th className="px-6 py-4 font-semibold text-gray-700 text-center">Date</th>
                <th className="px-6 py-4 font-semibold text-gray-700 text-center">Received By</th>
                <th className="px-6 py-4 font-semibold text-gray-700 text-center">Total Qty (Outer)</th>
                <th className="px-6 py-4 font-semibold text-gray-700 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.deliveryNoteNumber} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 text-center">{tx.deliveryNoteNumber}</td>
                  <td className="px-6 py-4 text-gray-600 text-center">{tx.date}</td>
                  <td className="px-6 py-4 text-gray-600 text-center">{tx.receivedBy || '-'}</td>
                  <td className="px-6 py-4 text-gray-900 font-semibold text-center">
                    {tx.totalQuantity.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => handleReprint(tx.deliveryNoteNumber)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Reprint"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete ${tx.deliveryNoteNumber}?`)) {
                            handleDelete(tx.deliveryNoteNumber);
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
