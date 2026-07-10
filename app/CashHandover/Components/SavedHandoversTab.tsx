import React, { useState, useEffect } from 'react';
import { ClipboardList, Printer, Trash2, X, Calendar, Edit2, AlertTriangle } from 'lucide-react';
import { CashHandover, getCashHandovers, deleteCashHandover } from '../Service/cash_handover_service';
import { generateHandoverPdf } from '../Utils/HandoverPdf';
import { toast } from '@/app/Components/Notification';

export default function SavedHandoversTab({ onEdit }: { onEdit?: (handover: CashHandover) => void }) {
  const [handovers, setHandovers] = useState<CashHandover[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHandover, setSelectedHandover] = useState<CashHandover | null>(null);
  const [handoverToDelete, setHandoverToDelete] = useState<CashHandover | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchHandovers();
  }, []);

  const fetchHandovers = async () => {
    setIsLoading(true);
    const data = await getCashHandovers();
    setHandovers(data);
    setIsLoading(false);
  };

  const handleReprint = async (handover: CashHandover) => {
    try {
      await generateHandoverPdf({
        data: {
          handoverId: handover.ID,
          date: handover.DATE,
          items: handover.ITEMS,
          totalAmount: handover.TOTAL_AMOUNT,
          receivedBy: handover.WHO_RECEIVED
        },
        filename: `${handover.ID}_${handover.DATE}`
      });
      toast.success('PDF generated successfully.');
    } catch (err) {
      toast.error('Error generating PDF.');
    }
  };

  const executeDelete = async () => {
    if (!handoverToDelete) return;
    setIsDeleting(true);
    const success = await deleteCashHandover(handoverToDelete.ID);
    if (success) {
      toast.success('Handover deleted successfully.');
      setHandoverToDelete(null);
      setSelectedHandover(null);
      fetchHandovers();
    } else {
      toast.error('Failed to delete handover.');
    }
    setIsDeleting(false);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Saved Handovers</h2>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-sm text-gray-500 font-medium">Loading handovers...</span>
        </div>
      ) : handovers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {handovers.map((handover) => (
            <button
              key={handover.ID}
              onClick={() => setSelectedHandover(handover)}
              className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-purple-300 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden w-full text-left"
            >
              <div className="h-1.5 bg-gradient-to-r from-purple-600 to-purple-400" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-purple-100">
                    <ClipboardList className="w-3 h-3" />
                    {handover.ID}
                  </span>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Received By</p>
                  <p className="text-base font-black text-gray-900 truncate" dir="auto">
                    {handover.WHO_RECEIVED}
                  </p>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Total Amount</p>
                  <p className="text-xl font-black text-gray-900">
                    {Number(handover.TOTAL_AMOUNT).toLocaleString()} <span className="text-sm text-gray-500">AED</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-400 font-medium">{handover.DATE}</span>
                  <span className="text-xs text-gray-300 mx-1">•</span>
                  <span className="text-xs text-gray-400 font-medium">{handover.ITEMS?.length || 0} Receipts</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5">
            <ClipboardList className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">No Handovers Found</h3>
          <p className="text-gray-500 font-medium text-sm">You haven't created any cash handovers yet.</p>
        </div>
      )}

      {/* Action Menu Modal */}
      {selectedHandover && !handoverToDelete && (
        <div 
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedHandover(null)}
        >
          <div 
            className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-50 rounded-2xl shrink-0">
                  <ClipboardList className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">{selectedHandover.ID}</h3>
                  <p className="text-sm text-gray-500 font-medium mt-0.5">{selectedHandover.DATE}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHandover(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleReprint(selectedHandover)}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <Printer className="w-5 h-5" />
                Reprint PDF
              </button>
              
              {onEdit && (
                <button
                  onClick={() => {
                    onEdit(selectedHandover);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 hover:-translate-y-0.5 transition-all"
                >
                  <Edit2 className="w-5 h-5" />
                  Edit
                </button>
              )}

              <button
                onClick={() => setHandoverToDelete(selectedHandover)}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 hover:-translate-y-0.5 transition-all"
              >
                <Trash2 className="w-5 h-5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Beautiful Delete Confirmation Modal */}
      {handoverToDelete && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => !isDeleting && setHandoverToDelete(null)}
        >
          <div 
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-red-100 animate-in zoom-in-95 duration-300 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            
            <h3 className="text-2xl font-black text-gray-900 mb-2">Delete Handover?</h3>
            <p className="text-gray-500 font-medium mb-8">
              Are you sure you want to delete handover <span className="font-bold text-gray-900">{handoverToDelete.ID}</span>? This action cannot be undone and all associated receipts will be removed.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setHandoverToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-4 px-4 bg-gray-50 text-gray-700 font-bold rounded-2xl hover:bg-gray-100 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-2 py-4 px-4 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Yes, Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
