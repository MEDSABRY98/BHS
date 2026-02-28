'use client';

import { useState } from 'react';
import { InvoiceRow } from '@/types';
import CustomersTab from './CustomersTab';
import CustomersMinsTab from './CustomersMinsTab';
import { Users, CreditCard, TrendingUp, TrendingDown, ArrowLeft, Wallet, FileText, AlertCircle, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

interface CustomersLandingProps {
    data: InvoiceRow[];
    initialCustomer?: string;
}

const VIEWS: ('normal' | 'credit' | 'ob_pos' | 'ob_neg')[] = ['normal', 'credit', 'ob_pos', 'ob_neg'];

export default function CustomersLanding({ data, initialCustomer }: CustomersLandingProps) {
    const [view, setView] = useState<'landing' | 'normal' | 'credit' | 'ob_pos' | 'ob_neg'>(
        initialCustomer ? 'normal' : 'normal'
    );
    const [isCustomerOpen, setIsCustomerOpen] = useState(!!initialCustomer);

    const currentIdx = VIEWS.indexOf(view as any);

    const handleNext = () => {
        if (isCustomerOpen) return;
        const nextIdx = (currentIdx + 1) % VIEWS.length;
        setView(VIEWS[nextIdx]);
    };

    const handlePrev = () => {
        if (isCustomerOpen) return;
        const prevIdx = (currentIdx - 1 + VIEWS.length) % VIEWS.length;
        setView(VIEWS[prevIdx]);
    };

    return (
        <div className="relative min-h-screen bg-white">
            {/* Sticky Sub-Header for Navigation */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm px-4 py-2 flex items-center justify-between border-b border-slate-100 transition-all">
                <div className="flex items-center gap-6">
                    <span className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        {view === 'normal' && <><Users className="w-5 h-5 text-blue-600" /> Customers Debit Analysis</>}
                        {view === 'credit' && <><Wallet className="w-5 h-5 text-emerald-600" /> Customers Credit Analysis</>}
                        {view === 'ob_pos' && <><TrendingUp className="w-5 h-5 text-amber-600" /> Open OB (Debit)</>}
                        {view === 'ob_neg' && <><TrendingDown className="w-5 h-5 text-purple-600" /> Open OB (Credit)</>}
                    </span>

                    <div className={`flex items-center gap-1 bg-slate-100 p-1 rounded-xl transition-opacity ${isCustomerOpen ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                        <button
                            onClick={handlePrev}
                            disabled={isCustomerOpen}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 hover:text-indigo-600 transition-all disabled:cursor-not-allowed"
                            title="Previous View"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                        <button
                            onClick={handleNext}
                            disabled={isCustomerOpen}
                            className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-500 hover:text-indigo-600 transition-all disabled:cursor-not-allowed"
                            title="Next View"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>


            </div>

            <div>
                {view === 'normal' && <CustomersTab data={data} mode="DEBIT" initialCustomer={initialCustomer} onCustomerToggle={setIsCustomerOpen} />}
                {view === 'credit' && <CustomersMinsTab data={data} onCustomerToggle={setIsCustomerOpen} />}
                {view === 'ob_pos' && <CustomersTab data={data} mode="OB_POS" onCustomerToggle={setIsCustomerOpen} />}
                {view === 'ob_neg' && <CustomersTab data={data} mode="OB_NEG" onCustomerToggle={setIsCustomerOpen} />}
            </div>
        </div>
    );
}
