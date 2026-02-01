'use client';

import { useState, useEffect } from 'react';
import SuppliersTab from '@/components/SuppliersTab';
import Login from '@/components/Login';
import { ArrowLeft, Package } from 'lucide-react';

export default function SuppliersPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                setCurrentUser(JSON.parse(savedUser));
                setIsAuthenticated(true);
            } catch (e) {
                localStorage.removeItem('currentUser');
            }
        }
    }, []);

    const handleLogin = (user: any) => {
        setIsAuthenticated(true);
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
    };

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

                    <div className="flex items-center gap-4">
                    </div>
                </div>
            </div>

            <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <main className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[calc(100vh-8rem)]">
                    <SuppliersTab />
                </main>
            </div>
        </div>
    );
}
