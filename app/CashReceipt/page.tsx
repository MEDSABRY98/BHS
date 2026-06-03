'use client';

import { useState, useEffect } from 'react';
import CashReceiptTab from '@/components/CashReceipt/CashReceiptTab';
import Login from '@/components/01-Unified/Login';
import Loading from '@/components/01-Unified/Loading';
import CashReceiptSidebar from '@/components/CashReceipt/CashReceiptSidebar';
import { Menu, Search } from 'lucide-react';

export default function CashReceiptPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<'new' | 'saved'>('new');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load sidebar collapsed state on mount
  useEffect(() => {
    const stored = localStorage.getItem('cashReceiptSidebarCollapsed');
    if (stored === 'false') {
      setIsSidebarCollapsed(false);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem('cashReceiptSidebarCollapsed', String(nextState));
  };

  useEffect(() => {
    const validateAndSetUser = async () => {
      try {
        const savedUser = localStorage.getItem('currentUser');
        const savedPassword = localStorage.getItem('userPassword');

        if (savedUser && savedPassword) {
          try {
            const userData = JSON.parse(savedUser);
            if (userData && userData.name) {
              // Verify user still exists and password is correct
              const response = await fetch('/DataBase/Users/api', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: userData.name,
                  password: savedPassword,
                }),
              });

              const result = await response.json();

              if (response.ok && result.success) {
                setIsAuthenticated(true);
                setCurrentUser(result.user);
                localStorage.setItem('currentUser', JSON.stringify(result.user));
              } else {
                localStorage.removeItem('currentUser');
                localStorage.removeItem('userPassword');
              }
            }
          } catch (e) {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('userPassword');
          }
        }
      } catch (error) {
        console.error('Error validating user:', error);
      } finally {
        setIsChecking(false);
      }
    };

    validateAndSetUser();
  }, []);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userPassword', user.password);
  };

  if (isChecking) {
    return <Loading message="Loading Cash Receipt Data..." />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0d0e10] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <CashReceiptSidebar
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
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0d0e10] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <CashReceiptSidebar
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
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300 no-print">
          <div className="max-w-[98%] mx-auto px-4 py-3 flex items-center justify-between gap-4 min-h-[5rem]">
            {/* Left section: Hamburger for Mobile */}
            <div className="flex items-center gap-4 w-10 md:w-32">
              <button 
                onClick={() => setIsMobileSidebarOpen(true)} 
                className="p-2.5 text-slate-600 hover:text-slate-900 lg:hidden rounded-xl hover:bg-slate-100 transition-all"
                title="Open Navigation Menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>

            {/* Middle Section: Display Active Tab Label OR centered Search Box */}
            <div className="flex-1 flex items-center justify-center">
              {activeTab === 'saved' ? (
                <div className="relative w-full max-w-lg mx-auto">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search saved receipts by number or customer..."
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-100 hover:bg-slate-200/70 focus:bg-white border-2 border-transparent focus:border-amber-500 rounded-2xl text-sm focus:ring-0 transition-all outline-none shadow-inner"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              ) : (
                <span className="text-lg font-extrabold text-slate-800 tracking-tight">
                  New Receipt
                </span>
              )}
            </div>

            {/* Right Section: Spacer to maintain center alignment */}
            <div className="w-10 md:w-32 flex justify-end" />
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-[98%] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full">
          <CashReceiptTab
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </div>
      </div>
    </div>
  );
}
