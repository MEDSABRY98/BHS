'use client';

import { useState } from 'react';
import { InvoiceRow } from '@/types';
import CustomersTab from './CustomersTab';
import CustomersMinsTab from './CustomersMinsTab';
import { Users, CreditCard, TrendingUp, TrendingDown, ArrowLeft, Wallet, FileText, AlertCircle } from 'lucide-react';

interface CustomersLandingProps {
    data: InvoiceRow[];
}

export default function CustomersLanding({ data }: CustomersLandingProps) {
    const [view, setView] = useState<'landing' | 'normal' | 'credit' | 'ob_pos' | 'ob_neg'>('landing');

    if (view === 'landing') {
        return (
            <div className="p-6 md:p-10 min-h-[600px] flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-white">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">Customer Analysis Hub</h2>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                    {/* Tile 1: Normal Customers (Debit) */}
                    <button
                        onClick={() => setView('normal')}
                        className="group relative p-8 bg-white rounded-3xl border-2 border-slate-100 shadow-xl hover:shadow-2xl hover:border-blue-200 transition-all duration-300 text-left overflow-hidden hover:-translate-y-1"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Users className="w-40 h-40 text-blue-600" />
                        </div>
                        <div className="relative z-10">
                            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <Users className="w-7 h-7" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">Customers Debit</h3>

                        </div>
                    </button>

                    {/* Tile 2: Credit Balances */}
                    <button
                        onClick={() => setView('credit')}
                        className="group relative p-8 bg-white rounded-3xl border-2 border-slate-100 shadow-xl hover:shadow-2xl hover:border-emerald-200 transition-all duration-300 text-left overflow-hidden hover:-translate-y-1"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <Wallet className="w-40 h-40 text-emerald-600" />
                        </div>
                        <div className="relative z-10">
                            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <Wallet className="w-7 h-7" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-emerald-600 transition-colors">Credit Balances</h3>

                        </div>
                    </button>

                    {/* Tile 3: Open OB (Positive) */}
                    <button
                        onClick={() => setView('ob_pos')}
                        className="group relative p-8 bg-white rounded-3xl border-2 border-slate-100 shadow-xl hover:shadow-2xl hover:border-amber-200 transition-all duration-300 text-left overflow-hidden hover:-translate-y-1"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <TrendingUp className="w-40 h-40 text-amber-600" />
                        </div>
                        <div className="relative z-10">
                            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mb-6 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                <TrendingUp className="w-7 h-7" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-amber-600 transition-colors">Open OB (Debit)</h3>

                        </div>
                    </button>

                    {/* Tile 4: Open OB (Negative) */}
                    <button
                        onClick={() => setView('ob_neg')}
                        className="group relative p-8 bg-white rounded-3xl border-2 border-slate-100 shadow-xl hover:shadow-2xl hover:border-purple-200 transition-all duration-300 text-left overflow-hidden hover:-translate-y-1"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                            <TrendingDown className="w-40 h-40 text-purple-600" />
                        </div>
                        <div className="relative z-10">
                            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                <TrendingDown className="w-7 h-7" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-purple-600 transition-colors">Open OB (Credit)</h3>

                        </div>
                    </button>
                </div>
            </div>
        );
    }

    const handleBack = () => setView('landing');

    return (
        <div className="relative min-h-screen bg-slate-50">
            {/* Sticky Sub-Header for Back Navigation */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm px-6 py-3 flex items-center gap-4 transition-all">
                <button
                    onClick={handleBack}
                    className="group flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold px-4 py-2 rounded-xl hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100"
                >
                    <div className="bg-slate-100 group-hover:bg-blue-200 group-hover:text-blue-700 rounded-lg p-1 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                    </div>
                    Back to Selection
                </button>
                <div className="h-6 w-px bg-slate-300 mx-2"></div>
                <span className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    {view === 'normal' && <><Users className="w-5 h-5 text-blue-600" /> Customers Debit Analysis</>}
                    {view === 'credit' && <><Wallet className="w-5 h-5 text-emerald-600" /> Credit Balances Analysis</>}
                    {view === 'ob_pos' && <><TrendingUp className="w-5 h-5 text-amber-600" /> Open OB (Debit)</>}
                    {view === 'ob_neg' && <><TrendingDown className="w-5 h-5 text-purple-600" /> Open OB (Credit)</>}
                </span>
            </div>

            <div className="p-4 sm:p-6">
                {view === 'normal' && <CustomersTab data={data} mode="DEBIT" />}
                {view === 'credit' && <CustomersMinsTab data={data} />}
                {view === 'ob_pos' && <CustomersTab data={data} mode="OB_POS" />}
                {view === 'ob_neg' && <CustomersTab data={data} mode="OB_NEG" />}
            </div>
        </div>
    );
}
