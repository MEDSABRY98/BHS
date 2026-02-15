'use client';

import { useState, useEffect } from 'react';
import SuppliersTab from '@/components/SuppliersTab';
import Login from '@/components/Login';
import Loading from '@/components/Loading';
import { ArrowLeft, Package, FileText, CheckSquare } from 'lucide-react';

interface SupplierTransaction {
    date: string;
    number: string;
    supplierName: string;
    amount: number;
    type: 'Purchase' | 'Refund';
}

export default function SuppliersPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'statements' | 'matching'>('statements');

    useEffect(() => {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                setCurrentUser(JSON.parse(savedUser));
                setIsAuthenticated(true);
            } catch (e) {
                localStorage.removeItem('currentUser');
            } finally {
                setIsChecking(false);
            }
        } else {
            setIsChecking(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/suppliers');
            const json = await res.json();
            if (json.data) {
                setTransactions(json.data);
            }
        } catch (e) {
            console.error('Failed to fetch suppliers', e);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = (user: any) => {
        setIsAuthenticated(true);
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
    };

    if (isChecking || (isAuthenticated && loading)) {
        return <Loading message={loading ? "Loading Suppliers Data..." : "Authenticating..."} />;
    }

    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900 pb-12">
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
                <div className="max-w-[98%] mx-auto px-4 py-3 flex items-center justify-between gap-4 min-h-[5rem]">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-teal-600 to-emerald-600 text-white p-2.5 rounded-xl shadow-lg shadow-teal-200">
                                <Package className="w-6 h-6" />
                            </div>
                            <h1 className="text-xl font-black text-slate-800 tracking-tight hidden md:block">Suppliers</h1>
                        </div>
                    </div>

                    <div className="flex-1 flex justify-center">
                        <div className="flex p-1 bg-slate-100/50 rounded-2xl border border-slate-200">
                            <button
                                onClick={() => setActiveTab('statements')}
                                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'statements'
                                        ? 'bg-white text-teal-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <FileText className="w-4 h-4" />
                                Statements
                            </button>
                            <button
                                onClick={() => setActiveTab('matching')}
                                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'matching'
                                        ? 'bg-white text-teal-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <CheckSquare className="w-4 h-4" />
                                Matching
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                    </div>
                </div>
            </div>

            <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <main className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[calc(100vh-8rem)]">
                    <SuppliersTab data={transactions} activeTab={activeTab} />
                </main>
            </div>
        </div>
    );
}
