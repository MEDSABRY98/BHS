import React from 'react';
import { Mail, CalendarDays } from 'lucide-react';

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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] px-4 py-8 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-start px-6 pt-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Generate Statements</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center border border-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-2">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Statement Date</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <CalendarDays className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="date"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-base py-3 pl-11 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold shadow-sm"
                value={emailStatementDate}
                onChange={(e) => setEmailStatementDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 transition-colors border border-slate-200 shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(emailStatementDate)}
              disabled={isProcessing}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
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
