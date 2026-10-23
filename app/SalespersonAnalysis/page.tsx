'use client';

import { isAdminRole } from '@/lib/AdminRole';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Filter, Menu, X } from 'lucide-react';
import { useLiveCurrentUser } from '../Components/Auth/AppSessionProvider';
import TabLoader from '../Components/Loading/TabLoader';
import MainLoader from '../Components/Loading/MainLoader';
import NoData from '../Components/DataState/NoDataTab';
import TabFetchError from '../Components/DataState/TabFetchError';
import { SalespersonDataProvider, UseSalespersonData } from './Context/SalespersonDataContext';
import SalespersonSidebar, { SALESPERSON_TABS, type SalespersonTabId } from './Utils/Sidebar';
import SalespersonPicker from './Utils/SalespersonPicker';
import SalesTab from './Sales/SalesTab';
import DebitTab from './Debit/DebitTab';
import CollectionsTab from './Collections/CollectionsTab';
import QualityTab from './Quality/QualityTab';

const ALL_TABS = SALESPERSON_TABS.map((t) => t.id) as SalespersonTabId[];

/** Tabs allowed by Admin Control ('salesperson-analysis' sub tabs); no list = all tabs. */
function AllowedTabs(user: any): SalespersonTabId[] {
  try {
    if (isAdminRole(user, 'salesperson-analysis')) return ALL_TABS;
    const roleStr = String(user?.role || '').trim();
    if (!roleStr || roleStr === 'Admin') return ALL_TABS;
    const perms = JSON.parse(roleStr);
    const list = perms?.['salesperson-analysis'];
    if (Array.isArray(list) && list.length > 0) {
      const allowed = ALL_TABS.filter((t) => list.includes(t));
      return allowed.length ? allowed : ALL_TABS;
    }
  } catch {
    // full access by default
  }
  return ALL_TABS;
}

function SalespersonShell() {
  const user = useLiveCurrentUser();
  const allowedTabs = useMemo(() => AllowedTabs(user), [user]);
  const [activeTab, setActiveTab] = useState<SalespersonTabId>(allowedTabs[0]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { data, loading, error, selectedId, listLoading, refresh, minDays, setMinDays } = UseSalespersonData();
  const [minText, setMinText] = useState(minDays ? String(minDays) : '');
  // salesperson + period are picked in the Filters popup (sidebar → Filters)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showPeriod = activeTab !== 'debit';

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFiltersOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filtersOpen]);

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) setActiveTab(allowedTabs[0]);
  }, [allowedTabs, activeTab]);

  const renderBody = () => {
    if (error && !data) {
      return <TabFetchError message={error} onRetry={() => void refresh()} />;
    }
    if (!selectedId) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 min-h-[55vh]">
          <NoData title="PICK A SALESPERSON" />
        </div>
      );
    }
    if (!data) return null;
    if (activeTab === 'sales') return <SalesTab />;
    if (activeTab === 'debit') return <DebitTab />;
    if (activeTab === 'quality') return <QualityTab />;
    return <CollectionsTab />;
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-slate-200 shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}
      >
        <SalespersonSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          allowedTabs={allowedTabs}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      </aside>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
      >
        <SalespersonSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          allowedTabs={allowedTabs}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <div className="lg:hidden p-4 flex items-center bg-white border-b border-slate-200">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2.5 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-bold text-slate-900 tracking-wide">Salesperson Analysis</span>
        </div>

        {(listLoading || loading) && !(error && !data) ? (
          <TabLoader className="!min-h-full flex-1" />
        ) : (
          <div className="max-w-[92%] 2xl:max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {SALESPERSON_TABS.find((t) => t.id === activeTab)?.label}
                </h2>
                {/* Debit: only customers with debit older than this many days */}
                {activeTab === 'debit' && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-wider text-slate-400 pointer-events-none">
                      Overdue &gt;
                    </span>
                    <span className="absolute right-9 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-wider text-slate-400 pointer-events-none">
                      days
                    </span>
                    <input
                      value={minText}
                      onChange={(e) => {
                        // Arabic digits (٠-٩ / ۰-۹) count too, commas are ignored
                        const v = e.target.value
                          .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
                          .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
                          .replace(/[^\d]/g, '')
                          .slice(0, 4);
                        setMinText(v);
                        setMinDays(Number(v) || 0);
                      }}
                      inputMode="numeric"
                      placeholder="0"
                      className={`h-10 w-52 pl-[78px] pr-[70px] text-center rounded-xl border bg-white text-sm font-bold text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15 ${
                        minDays > 0 ? 'border-[#D4AF37]' : 'border-slate-200'
                      }`}
                      title="Show only the customers with debit older than this many days"
                    />
                    {minText && (
                      <button
                        type="button"
                        onClick={() => {
                          setMinText('');
                          setMinDays(0);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
                        title="Clear"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {renderBody()}
          </div>
        )}
      </div>

      {/* Filters popup: the salesperson / period box */}
      {filtersOpen && (
        <div
          className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onMouseDown={(e) => e.target === e.currentTarget && setFiltersOpen(false)}
        >
          <div className="w-full max-w-2xl bg-slate-50 rounded-3xl shadow-2xl">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white rounded-t-3xl">
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center shadow-lg shadow-[#D4AF37]/30">
                <Filter className="w-5 h-5" />
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 leading-tight">Filters</h3>
                <p className="text-xs font-semibold text-slate-400">{showPeriod ? 'Salesperson and period' : 'Salesperson'}</p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="w-9 h-9 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <SalespersonPicker showPeriod={showPeriod} />
            </div>
            <div className="flex justify-end px-6 pb-6">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="h-11 px-8 rounded-xl bg-[#0f0f0f] text-[#D4AF37] text-xs font-black uppercase tracking-wider hover:bg-black shadow-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalespersonAnalysisPage() {
  return (
    <Suspense fallback={<MainLoader />}>
      <SalespersonDataProvider>
        <SalespersonShell />
      </SalespersonDataProvider>
    </Suspense>
  );
}
