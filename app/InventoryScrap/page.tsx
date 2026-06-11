'use client';

import { useState, useEffect } from 'react';
import InventoryScrapTab from '@/app/Inventory/Components/InventoryScrap/InventoryScrapTab';
import Login from '@/app/Components/Login';
import Loading from '@/app/Components/Loading';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Layers,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Lock,
  FileText,
  History
} from 'lucide-react';

export default function InventoryScrapPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeSubTab, setActiveSubTab] = useState<'record' | 'sessions' | 'report' | 'history'>('record');

  // Sidebar Collapse states
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userInitial, setUserInitial] = useState('U');

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        setIsAuthenticated(true);
        if (parsed.name) {
          setUserInitial(parsed.name.charAt(0).toUpperCase());
        }

        // Check permission for inventory-scrap
        const userName = parsed.name?.toLowerCase() || '';
        if (userName === 'med sabry') {
          setIsAllowed(true);
        } else {
          try {
            const roleStr = parsed.role || '';
            if (roleStr) {
              const perms = JSON.parse(roleStr);
              if (perms.systems) {
                setIsAllowed(perms.systems.includes('inventory-scrap'));
              } else {
                setIsAllowed(true);
              }
            } else {
              setIsAllowed(true);
            }
          } catch (e) {
            setIsAllowed(true);
          }
        }
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
    const stored = localStorage.getItem('scrapSidebarCollapsed');
    if (stored === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('scrapSidebarCollapsed', String(nextState));
  };

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    if (user.name) {
      setUserInitial(user.name.charAt(0).toUpperCase());
    }
    localStorage.setItem('currentUser', JSON.stringify(user));

    // Check permission for inventory-scrap on login
    const userName = user.name?.toLowerCase() || '';
    if (userName === 'med sabry') {
      setIsAllowed(true);
    } else {
      try {
        const roleStr = user.role || '';
        if (roleStr) {
          const perms = JSON.parse(roleStr);
          if (perms.systems) {
            setIsAllowed(perms.systems.includes('inventory-scrap'));
          } else {
            setIsAllowed(true);
          }
        } else {
          setIsAllowed(true);
        }
      } catch (e) {
        setIsAllowed(true);
      }
    }
  };

  if (isChecking) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-lg border border-slate-200/60 flex flex-col items-center">
          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mb-6 text-red-500 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Access Denied</h2>
          <p className="text-slate-500 mt-2 font-medium">You do not have permission to access the Inventory Scrap module.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-8 w-full flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md active:scale-95 text-sm uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black font-sans selection:bg-blue-100 selection:text-blue-900">

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col ${isCollapsed ? 'w-20' : 'w-72'} bg-black text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>

        {/* Back Home Button wrapper */}
        <div className={`px-4 ${isCollapsed ? 'lg:px-4' : 'lg:px-8'} pt-6 pb-2 bg-black/50 backdrop-blur-md transition-all duration-300`}>
          <button
            onClick={() => window.location.href = '/'}
            className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-red-500 hover:text-red-400 transition-all duration-200 group w-full cursor-pointer`}
          >
            <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
            {!isCollapsed && (
              <span className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300">
                Back Home
              </span>
            )}
          </button>
        </div>

        {/* Title and Icon */}
        <div className={`px-4 ${isCollapsed ? 'py-4' : 'pt-2 pb-6'} shrink-0 flex flex-col items-center justify-center transition-all duration-300`}>
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-[#D4AF37] rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-[#D4AF37]/20 transition-all duration-300">
              <Trash2 className="w-7 h-7 text-black" />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-300">
                <h2 className="text-xl font-bold tracking-tight text-white">BHS SCRAP</h2>
                <p className="text-[10px] text-[#D4AF37] font-bold tracking-[0.2em] uppercase">Inventory Loss</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Sidebar Options */}
        <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar">

          <button
            onClick={() => setActiveSubTab('record')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-4' : 'px-6'} py-4 transition-all duration-200 group cursor-pointer ${activeSubTab === 'record'
              ? 'bg-gradient-to-r from-black/10 to-transparent border-l-4 border-[#D4AF37] text-white font-bold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            title={isCollapsed ? "Log Scrap" : undefined}
          >
            <Plus className={`w-5 h-5 transition-colors ${isCollapsed ? '' : 'mr-4'} ${activeSubTab === 'record' ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
            {!isCollapsed && (
              <span className="text-sm tracking-wide whitespace-nowrap">Log Scrap</span>
            )}
            {!isCollapsed && activeSubTab === 'record' && <ChevronRight className="w-4 h-4 ml-auto text-[#D4AF37]" />}
          </button>

          <button
            onClick={() => setActiveSubTab('sessions')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-4' : 'px-6'} py-4 transition-all duration-200 group cursor-pointer ${activeSubTab === 'sessions'
              ? 'bg-gradient-to-r from-black/10 to-transparent border-l-4 border-[#D4AF37] text-white font-bold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            title={isCollapsed ? "View Sessions" : undefined}
          >
            <Layers className={`w-5 h-5 transition-colors ${isCollapsed ? '' : 'mr-4'} ${activeSubTab === 'sessions' ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
            {!isCollapsed && (
              <span className="text-sm tracking-wide whitespace-nowrap">View Sessions</span>
            )}
            {!isCollapsed && activeSubTab === 'sessions' && <ChevronRight className="w-4 h-4 ml-auto text-[#D4AF37]" />}
          </button>

          <button
            onClick={() => setActiveSubTab('report')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-4' : 'px-6'} py-4 transition-all duration-200 group cursor-pointer ${activeSubTab === 'report'
              ? 'bg-gradient-to-r from-black/10 to-transparent border-l-4 border-[#D4AF37] text-white font-bold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            title={isCollapsed ? "Scrap Report" : undefined}
          >
            <FileText className={`w-5 h-5 transition-colors ${isCollapsed ? '' : 'mr-4'} ${activeSubTab === 'report' ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
            {!isCollapsed && (
              <span className="text-sm tracking-wide whitespace-nowrap">Scrap Report</span>
            )}
            {!isCollapsed && activeSubTab === 'report' && <ChevronRight className="w-4 h-4 ml-auto text-[#D4AF37]" />}
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-4' : 'px-6'} py-4 transition-all duration-200 group cursor-pointer ${activeSubTab === 'history'
              ? 'bg-gradient-to-r from-black/10 to-transparent border-l-4 border-[#D4AF37] text-white font-bold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            title={isCollapsed ? "Saved Reports" : undefined}
          >
            <History className={`w-5 h-5 transition-colors ${isCollapsed ? '' : 'mr-4'} ${activeSubTab === 'history' ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
            {!isCollapsed && (
              <span className="text-sm tracking-wide whitespace-nowrap">Saved Reports</span>
            )}
            {!isCollapsed && activeSubTab === 'history' && <ChevronRight className="w-4 h-4 ml-auto text-[#D4AF37]" />}
          </button>

        </nav>

        {/* Expand/Collapse Trigger */}
        <div className="p-4 border-t border-white/10 mt-auto flex justify-center">
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-[#D4AF37] cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area - Shifted by Sidebar Width on Desktop */}
      <div className={`flex-grow flex flex-col min-w-0 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>

        {/* Header - Mobile */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-black cursor-pointer">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-2">
              <Trash2 className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h1 className="font-black text-slate-800 text-base">BHS SCRAP</h1>
          </div>
          <div className="w-10 h-10 bg-black text-[#D4AF37] rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
            {userInitial}
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar Menu */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-black text-white transition-transform duration-300 transform lg:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
          <div className="px-8 pt-6 pb-2">
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center justify-center gap-3 py-2 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] w-full cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back Home
            </button>
          </div>
          <div className="px-8 pt-2 pb-6 shrink-0 relative flex flex-col items-center justify-center">
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="absolute right-4 top-2 p-2 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-[#D4AF37] rounded-lg flex items-center justify-center mb-3">
                <Trash2 className="w-6 h-6 text-black" />
              </div>
              <h2 className="text-lg font-bold text-white">BHS SCRAP</h2>
              <p className="text-[10px] text-[#D4AF37] font-bold tracking-[0.2em] uppercase">Inventory Loss</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto no-scrollbar">
            <button
              onClick={() => {
                setActiveSubTab('record');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center px-6 py-4 transition-all duration-200 group cursor-pointer ${activeSubTab === 'record'
                ? 'bg-gradient-to-r from-black/10 to-transparent border-l-4 border-[#D4AF37] text-white font-bold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Plus className={`w-5 h-5 mr-4 ${activeSubTab === 'record' ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
              <span className="text-sm tracking-wide">Log Scrap</span>
            </button>

            <button
              onClick={() => {
                setActiveSubTab('sessions');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center px-6 py-4 transition-all duration-200 group cursor-pointer ${activeSubTab === 'sessions'
                ? 'bg-gradient-to-r from-black/10 to-transparent border-l-4 border-[#D4AF37] text-white font-bold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <Layers className={`w-5 h-5 mr-4 ${activeSubTab === 'sessions' ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
              <span className="text-sm tracking-wide">View Sessions</span>
            </button>

            <button
              onClick={() => {
                setActiveSubTab('report');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center px-6 py-4 transition-all duration-200 group cursor-pointer ${activeSubTab === 'report'
                ? 'bg-gradient-to-r from-black/10 to-transparent border-l-4 border-[#D4AF37] text-white font-bold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <FileText className={`w-5 h-5 mr-4 ${activeSubTab === 'report' ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
              <span className="text-sm tracking-wide">Scrap Report</span>
            </button>

            <button
              onClick={() => {
                setActiveSubTab('history');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center px-6 py-4 transition-all duration-200 group cursor-pointer ${activeSubTab === 'history'
                ? 'bg-gradient-to-r from-black/10 to-transparent border-l-4 border-[#D4AF37] text-white font-bold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <History className={`w-5 h-5 mr-4 ${activeSubTab === 'history' ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
              <span className="text-sm tracking-wide">Saved Reports</span>
            </button>
          </nav>
        </aside>

        {/* Main Content Component Area */}
        <main className="flex-grow p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 min-h-[calc(100vh-6rem)]">
              <InventoryScrapTab activeSubTab={activeSubTab} />
            </div>
          </div>
        </main>
      </div>

    </div>
  );
}
