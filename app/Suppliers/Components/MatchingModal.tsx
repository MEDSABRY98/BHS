import React from 'react';
import { X } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';

interface MatchingModalProps {
    supplierName: string;
    months: string[];
    matchedTokens: string[];
    toggleMatchingMonth: (supplierName: string, month: string) => Promise<void>;
    isSaving: boolean;
    onClose: () => void;
}

export default function MatchingModal({
    supplierName,
    months,
    matchedTokens,
    toggleMatchingMonth,
    isSaving,
    onClose
}: MatchingModalProps) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                    <div>
                        <h3 className="text-xl font-black text-slate-800">{supplierName}</h3>
                        <p className="text-sm text-slate-400 font-bold mt-1">Select months to match</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600 outline-none"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {months.map(month => {
                            // Extract month token mapping logic (standardizeToken is imported at parent)
                            const cleanMonth = month.trim().toUpperCase();
                            const isMatched = matchedTokens.includes(cleanMonth);

                            return (
                                <button
                                    key={month}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        await toggleMatchingMonth(supplierName, month);
                                    }}
                                    className={`py-3 rounded-xl text-sm font-black transition-all border-2 flex items-center justify-center outline-none ${isMatched
                                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-100 scale-105'
                                        : 'bg-rose-50 text-rose-500 border-rose-100 hover:border-rose-200'
                                        }`}
                                >
                                    {month}
                                </button>
                            );
                        })}
                        {months.length === 0 && (
                            <div className="col-span-full py-12">
                                <NoData />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <span className="text-xs font-bold text-slate-500">Matched</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                            <span className="text-xs font-bold text-slate-500">Not Matched</span>
                        </div>
                        {isSaving && (
                            <div className="flex items-center gap-2 ml-4 text-teal-600">
                                <div className="w-3 h-3 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-bold">Saving...</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-black hover:bg-slate-900 transition-all uppercase tracking-wider outline-none"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
