'use client';

import { useState, useEffect } from 'react';
import Login from '@/components/Login';
import DiscountTrackerTab from '@/components/DiscountTrackerTab';
import { InvoiceRow } from '@/types';
import { ArrowLeft, Tag } from 'lucide-react';

export default function DiscountTrackerPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [data, setData] = useState<InvoiceRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => {
        if (isAuthenticated) {
            fetchData();
        }
    }, [isAuthenticated]);

    const handleLogin = (user: any) => {
        setIsAuthenticated(true);
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userPassword');
        window.location.href = '/';
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            // We still need the main data for the discount tracker validation logic
            const response = await fetch('/api/sheets');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.details || result.error || 'Failed to fetch data');
            }

            setData(result.data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
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
                            <div className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white p-2.5 rounded-xl shadow-lg shadow-orange-200">
                                <Tag className="w-6 h-6" />
                            </div>
                            <h1 className="text-xl font-black text-slate-800 tracking-tight">Discount Tracker</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* User info removed */}
                    </div>
                </div>
            </div>

            <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <main className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[calc(100vh-8rem)]">
                    {error ? (
                        <div className="flex items-center justify-center h-96">
                            <div className="text-center bg-red-50 p-6 rounded-lg">
                                <p className="text-red-600 text-lg mb-4">Error loading data</p>
                                <p className="text-gray-600 mb-4">{error}</p>
                                <button
                                    onClick={fetchData}
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    ) : (
                        <DiscountTrackerTab data={data} isLoading={loading} />
                    )}
                </main>
            </div>
        </div>
    );
}
