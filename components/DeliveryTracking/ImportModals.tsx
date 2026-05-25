import React from 'react';
import { X, Upload, FileText, Package, Download } from 'lucide-react';

interface ImportModalsProps {
    isImportOpen: boolean;
    setIsImportOpen: (open: boolean) => void;
    isLpoExcelOpen: boolean;
    setIsLpoExcelOpen: (open: boolean) => void;
    setImportType: (type: 'loi' | 'lpo' | 'invoice') => void;
    triggerFileInput: () => void;
    downloadTemplate: (type: 'loi' | 'lpo' | 'invoice') => void;
}

export default function ImportModals({
    isImportOpen,
    setIsImportOpen,
    isLpoExcelOpen,
    setIsLpoExcelOpen,
    setImportType,
    triggerFileInput,
    downloadTemplate
}: ImportModalsProps) {
    return (
        <>
            {/* GENERAL IMPORT MODAL */}
            {isImportOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-bold">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="text-[16px] font-black text-slate-800 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-indigo-600" />
                                Select Upload Type
                            </h3>
                            <button
                                onClick={() => setIsImportOpen(false)}
                                className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            {/* LOI */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setImportType('loi');
                                        setIsImportOpen(false);
                                        // Delay slightly to let modal state close before file dialog opens
                                        setTimeout(triggerFileInput, 100);
                                    }}
                                    className="flex-1 text-left p-4 rounded-xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group flex items-center gap-4"
                                >
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-none group-hover:scale-110 transition-transform">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="font-bold text-slate-800 text-[15px]">LPO & Complementary Steps</div>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        downloadTemplate('loi');
                                    }}
                                    title="Download Template"
                                    className="w-12 h-12 flex-none rounded-xl border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                            </div>

                            {/* LPO Only */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setImportType('lpo');
                                        setIsImportOpen(false);
                                        setTimeout(triggerFileInput, 100);
                                    }}
                                    className="flex-1 text-left p-4 rounded-xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group flex items-center gap-4"
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-none group-hover:scale-110 transition-transform">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <div className="font-bold text-slate-800 text-[15px]">LPO Only</div>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        downloadTemplate('lpo');
                                    }}
                                    title="Download Template"
                                    className="w-12 h-12 flex-none rounded-xl border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Invoice Complementary Steps */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setImportType('invoice');
                                        setIsImportOpen(false);
                                        setTimeout(triggerFileInput, 100);
                                    }}
                                    className="flex-1 text-left p-4 rounded-xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group flex items-center gap-4"
                                >
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-none group-hover:scale-110 transition-transform">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="font-bold text-slate-800 text-[15px]">Invoice Complementary Steps</div>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        downloadTemplate('invoice');
                                    }}
                                    title="Download Template"
                                    className="w-12 h-12 flex-none rounded-xl border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* LPO EXCEL ACTIONS MODAL */}
            {isLpoExcelOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300 font-bold">
                    <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
                        <div className="p-6 text-center border-b border-slate-50 bg-slate-50/50 relative">
                            <button
                                onClick={() => setIsLpoExcelOpen(false)}
                                className="absolute right-4 top-4 w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-[32px] mx-auto mb-4 shadow-inner">📊</div>
                            <h3 className="text-[20px] font-[900] text-slate-800 tracking-tight">LPO Excel Actions</h3>
                            <p className="text-slate-500 text-[13px] font-medium mt-1">Download template or upload records</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <button
                                onClick={() => {
                                    downloadTemplate('lpo');
                                    setIsLpoExcelOpen(false);
                                }}
                                className="w-full p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center gap-4 group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Download className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <div className="font-black text-slate-800 text-[15px]">Download Template</div>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setImportType('lpo');
                                    setIsLpoExcelOpen(false);
                                    setTimeout(triggerFileInput, 100);
                                }}
                                className="w-full p-4 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex items-center gap-4 group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <div className="font-black text-slate-800 text-[15px]">Upload Excel File</div>
                                </div>
                            </button>
                        </div>
                        <div className="p-4 bg-slate-50 flex justify-center">
                            <button
                                onClick={() => setIsLpoExcelOpen(false)}
                                className="px-8 py-2.5 rounded-xl font-black text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-all text-[13px]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
