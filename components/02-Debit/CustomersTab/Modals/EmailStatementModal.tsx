import React from 'react';
import { Mail } from 'lucide-react';

interface EmailStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailStatementDate: string;
  setEmailStatementDate: (date: string) => void;
  onConfirm: (date: string) => void;
  isProcessing: boolean;
}

const EmailStatementModal: React.FC<EmailStatementModalProps> = ({
  isOpen,
  onClose,
  emailStatementDate,
  setEmailStatementDate,
  onConfirm,
  isProcessing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] px-4 py-8 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200">
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Generate Statements</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="p-8">
          <div className="mb-6">
            <div className="relative group">
              <input
                type="date"
                className="w-full bg-gray-50 border-2 border-gray-200 text-gray-900 text-base py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-semibold"
                value={emailStatementDate}
                onChange={(e) => setEmailStatementDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(emailStatementDate)}
              disabled={isProcessing}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Generate ZIP
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailStatementModal;
