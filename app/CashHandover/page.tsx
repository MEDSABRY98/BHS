'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';
import HandoverForm from './Components/HandoverForm';
import HandoverSidebar from './Utils/Sidebar';
import { useCashHandoverTabAudit } from '@/app/Audit/Modules/CashHandoverTabAudit';
import SavedHandoversTab from './Components/SavedHandoversTab';
import { verifyUserCredentials } from '@/app/DataBase/Service/database_service';
import { CashHandover } from './Service/cash_handover_service';
import { ArrowLeft, ClipboardList } from 'lucide-react';

export default function CashHandoverPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
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
        <HandoverSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

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
