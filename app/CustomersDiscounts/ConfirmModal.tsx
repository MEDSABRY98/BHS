import React from "react";

export type ConfirmModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
};

interface ConfirmModalProps {
  modal: ConfirmModalState;
  closeConfirm: () => void;
}

export default function ConfirmModal({ modal, closeConfirm }: ConfirmModalProps) {
  if (!modal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-2xl font-bold text-gray-900 mb-3">{modal.title}</h3>
        <p className="text-gray-500 mb-8 leading-relaxed">
          {modal.message}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={closeConfirm}
            className="px-6 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            {modal.cancelText || "Cancel"}
          </button>
          <button
            onClick={() => {
              modal.onConfirm();
              closeConfirm();
            }}
            className={`px-6 py-3 font-bold rounded-xl transition-colors ${
              modal.isDestructive 
                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30" 
                : "bg-[#D4AF37] hover:bg-[#C5A030] text-gray-900 shadow-lg shadow-[#D4AF37]/30"
            }`}
          >
            {modal.confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
