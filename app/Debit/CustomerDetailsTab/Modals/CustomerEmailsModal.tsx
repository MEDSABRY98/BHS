import React from 'react';
import { CircleAlert, Mail, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../CustomersTab/CstomersUtils';

interface CustomerEmailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  emails: string[];
}

export default function CustomerEmailsModal({
  isOpen,
  onClose,
  customerName,
  emails,
}: CustomerEmailsModalProps) {
  const [copiedAll, setCopiedAll] = React.useState(false);

  const emailList = React.useMemo(
    () =>
      Array.from(
        new Set(
          emails.flatMap((item) =>
            item
              .split(/[,;]+/)
              .map((email) => email.trim())
              .filter(Boolean),
          ),
        ),
      ),
    [emails],
  );

  if (!isOpen) return null;

  const handleCopyAll = async () => {
    if (emailList.length === 0) return;
    const success = await copyToClipboard(emailList.join(', '));
    if (success) {
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1500);
    } else {
      alert('Failed to copy emails');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] px-4 py-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start px-6 pt-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
              <CircleAlert className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Customer Emails</h3>
              <p className="text-sm text-slate-500 mt-1">{customerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center border border-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="px-6 pb-6">
          {emailList.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No emails found for this customer.</p>
          ) : (
            <>
              <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {emailList.map((email) => (
                  <li
                    key={email}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <Mail className="h-4 w-4 text-purple-600 shrink-0" />
                    <a href={`mailto:${email}`} className="text-sm font-semibold text-slate-800 break-all hover:text-blue-600">
                      {email}
                    </a>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleCopyAll}
                className="mt-4 w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                {copiedAll ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedAll ? 'Copied!' : 'Copy All Emails'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
