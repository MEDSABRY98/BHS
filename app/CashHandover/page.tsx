'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Login from '@/app/Components/Login';
import Loading from '@/app/Components/Loading';
import HandoverForm from './Components/HandoverForm';
import HandoverSidebar from './Components/HandoverSidebar';
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
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2"
              title="Back to Home"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-bold hidden sm:block">Back</span>
            </button>
            <div className="flex items-center gap-2 text-purple-600">
              <ClipboardList className="w-6 h-6" />
              <span className="font-black text-lg tracking-tight uppercase">
                {activeTab === 'new' ? 'Cash Handover' : 'Saved Handovers'}
              </span>
            </div>
          </div>
        </div>
      </header>

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
