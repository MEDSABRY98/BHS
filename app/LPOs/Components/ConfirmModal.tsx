import { AlertCircle, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  title?: string;
  message?: string;
}

export function ConfirmModal({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  isLoading = false,
  title = "Confirm Save",
  message = "Are you sure you want to save these changes?"
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/0 backdrop-blur-none animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#D4AF37]/10 text-[#D4AF37] rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black text-black tracking-tight mb-2">{title}</h3>
          <p className="text-sm font-bold text-gray-500 mb-8">{message}</p>
          
          <div className="flex w-full gap-4">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 py-4 bg-gray-50 text-black rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              No, Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 py-4 bg-black text-[#D4AF37] rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-gray-900 transition-all shadow-lg shadow-black/10 flex items-center justify-center disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
