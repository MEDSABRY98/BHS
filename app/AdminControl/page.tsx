'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import UserActivityTab from './UserActivityTab/UserActivityTab';
import AdminControlTab from './AdminControlTab/AdminControlTab';
import AdminSidebar from './Utils/Sidebar';
import TabPanel from '@/app/Components/Layout/TabPanel';
import { verifyUserCredentials } from '@/app/DataBase/Service/database_service';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';

export default function AdminControlPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('admin-control');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['admin-control']));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('adminSidebarCollapsed');
    if (stored === 'false') {
      setIsSidebarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    const validateAndSetUser = async () => {
      setIsLoading(true);
      const savedUser = localStorage.getItem('currentUser');
      const savedPassword = localStorage.getItem('userPassword');

      if (savedUser && savedPassword) {
        try {
          const userData = JSON.parse(savedUser);
          if (userData && userData.name) {
            const result = await verifyUserCredentials(userData.name, savedPassword);

            if (result.success && result.user) {
              setCurrentUser(result.user);
              setIsAuthenticated(true);
              localStorage.setItem('currentUser', JSON.stringify(result.user));

              if (result.user.name !== 'MED Sabry') {
                router.push('/');
              }
            } else {
              localStorage.removeItem('currentUser');
              localStorage.removeItem('userPassword');
            }
          }
        } catch {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('userPassword');
        }
      }
      setTimeout(() => setIsLoading(false), 800);
    };

    void validateAndSetUser();
  }, [router]);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    if (user.name !== 'MED Sabry') {
      router.push('/');
    }
  };

  useEffect(() => {
    setVisitedTabs((prev) => new Set(prev).add(activeTab));
  }, [activeTab]);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem('adminSidebarCollapsed', String(nextState));
  };

  const adminName = currentUser?.name || '';

  if (isLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentUser?.name !== 'MED Sabry') {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside
        className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}
      >
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </aside>

      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
      >
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </aside>

      <div
        className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}
      >
        <div className="lg:hidden p-4 flex items-center bg-white border-b border-slate-200">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-bold text-slate-800">Admin Control</span>
        </div>

        <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full">
          <TabPanel tabId="admin-control" activeTab={activeTab} isVisited={visitedTabs.has('admin-control')}>
            <AdminControlTab />
          </TabPanel>
          <TabPanel tabId="user-activity" activeTab={activeTab} isVisited={visitedTabs.has('user-activity')}>
            <UserActivityTab adminName={adminName} />
          </TabPanel>
        </div>
      </div>
    </div>
  );
}
