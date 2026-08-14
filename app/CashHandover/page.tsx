'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';
import HandoverForm from './Components/HandoverForm';
import HandoverSidebar, { CASH_HANDOVER_TAB_IDS } from './Utils/Sidebar';
import { getAllowedModuleTabIds } from '@/app/AdminControl/AdminControlTab';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useCashHandoverTabAudit } from '@/app/Audit/Model/CashHandoverTabAudit';
import SavedHandoversTab from './Components/SavedHandoversTab';
import { verifyUserCredentials } from '@/app/DataBase/Service/database_service';
import { CashHandover } from './Service/cash_handover_service';
import { ArrowLeft, ClipboardList } from 'lucide-react';

export default function CashHandoverPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'new' | 'saved'>('new');
  const [editHandover, setEditHandover] = useState<CashHandover | null>(null);

  useCashHandoverTabAudit(activeTab);

  useEffect(() => {
    const validateAndSetUser = async () => {
      try {
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
                const allowed = getAllowedModuleTabIds(result.user, 'cash-handover', CASH_HANDOVER_TAB_IDS);
                if (allowed.length > 0 && !allowed.includes('new')) setActiveTab(allowed[0] as 'new' | 'saved');
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

  useEffect(() => {
    if (!currentUser) return;
    const allowed = getAllowedModuleTabIds(currentUser, 'cash-handover', CASH_HANDOVER_TAB_IDS);
    if (allowed.length > 0 && !allowed.includes(activeTab)) {
      setActiveTab(allowed[0] as 'new' | 'saved');
    }
  }, [currentUser, activeTab]);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userPassword', user.password);
    const allowed = getAllowedModuleTabIds(user, 'cash-handover', CASH_HANDOVER_TAB_IDS);
    if (allowed.length > 0 && !allowed.includes('new')) setActiveTab(allowed[0] as 'new' | 'saved');
  };

  if (isChecking) {
    return <Loading message="Loading Cash Handover Data..." />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-black flex-col">
      {/* Main Layout */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden w-full">
        {/* Sidebar */}
        <HandoverSidebar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 no-print custom-scrollbar">
          <div className="max-w-7xl mx-auto pb-20">
            {activeTab === 'new' && (
              <HandoverForm 
                currentUser={currentUser} 
                editHandover={editHandover}
                onSaveComplete={() => setEditHandover(null)}
              />
            )}
            {activeTab === 'saved' && (
              <SavedHandoversTab 
                onEdit={(handover) => {
                  setEditHandover(handover);
                  setActiveTab('new');
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
