'use client';

import { useState, useEffect } from 'react';
import SuppliersTab from '@/components/Suppliers/SuppliersTab';
import Login from '@/components/01-Unified/Login';
import Loading from '@/components/01-Unified/Loading';
import SuppliersSidebar from '@/components/Suppliers/SuppliersSidebar';
import { Menu } from 'lucide-react';

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

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Load sidebar collapsed state on mount
    useEffect(() => {
        const stored = localStorage.getItem('suppliersSidebarCollapsed');
        if (stored === 'false') {
            setIsSidebarCollapsed(false);
        }
    }, []);

    const toggleSidebar = () => {
        const nextState = !isSidebarCollapsed;
        setIsSidebarCollapsed(nextState);
        localStorage.setItem('suppliersSidebarCollapsed', String(nextState));
    };

    useEffect(() => {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                setCurrentUser(user);
                setIsAuthenticated(true);

                // Set initial tab based on permissions
                try {
                    const perms = JSON.parse(user.role || '{}');
                    if (perms['suppliers'] && user.name !== 'MED Sabry') {
                        const allowed = perms['suppliers'];
                        if (allowed.length > 0 && !allowed.includes('statements')) {
                            setActiveTab(allowed[0] as any);
                        }
                    }
                } catch (e) { }
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
            const res = await fetch('/api/Suppliers');
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
        <div className="flex min-h-screen bg-[#F8F9FA] text-black">
            {/* Sidebar - Desktop */}
            <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a1215] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
                <SuppliersSidebar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    currentUser={currentUser}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={toggleSidebar}
                />
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a1215] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
                <SuppliersSidebar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    currentUser={currentUser}
                    isCollapsed={false}
                    onToggleCollapse={() => {}}
                    onCloseMobile={() => setIsMobileSidebarOpen(false)}
                />
            </aside>

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
                {/* Header */}
                <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
                    <div className="max-w-[98%] mx-auto px-4 py-3 flex items-center justify-between gap-4 min-h-[5rem]">
                        {/* Left section: Hamburger for Mobile */}
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setIsMobileSidebarOpen(true)} 
                                className="p-2.5 text-slate-600 hover:text-slate-900 lg:hidden rounded-xl hover:bg-slate-100 transition-all"
                                title="Open Navigation Menu"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Middle Section: Display Active Tab Label */}
                        <div className="hidden md:flex items-center gap-2">
                            <span className="text-lg font-extrabold text-slate-800 tracking-tight">
                                {activeTab === 'statements' ? 'Statements' : 'Matching'}
                            </span>
                        </div>

                        {/* Right Section: Spacer */}
                        <div className="w-10 h-10" />
                    </div>
                </header>

                {/* Main Content */}
                <div className="max-w-[98%] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full">
                    <main className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[calc(100vh-8rem)]">
                        <SuppliersTab data={transactions} activeTab={activeTab} />
                    </main>
                </div>
            </div>
        </div>
    );
}
