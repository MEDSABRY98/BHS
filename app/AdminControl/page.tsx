'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import AdminControlTab from './AdminControlTab';

import { verifyUserCredentials } from '@/app/DataBase/Service/database_service';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';

export default function AdminControlPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const validateAndSetUser = async () => {
      setIsLoading(true);
      const savedUser = localStorage.getItem('currentUser');
      const savedPassword = localStorage.getItem('userPassword');

      if (savedUser && savedPassword) {
        try {
          const userData = JSON.parse(savedUser);
          if (userData && userData.name) {
            // Verify user still exists and password is correct
            const result = await verifyUserCredentials(userData.name, savedPassword);

            if (result.success && result.user) {
              // User still exists and credentials are valid
              setCurrentUser(result.user);
              setIsAuthenticated(true);
              // Update localStorage with fresh user data
              localStorage.setItem('currentUser', JSON.stringify(result.user));
              
              if (result.user.name !== 'MED Sabry') {
                  router.push('/');
              }
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
      setTimeout(() => setIsLoading(false), 800);
    };

    validateAndSetUser();
  }, [router]);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    if (user.name !== 'MED Sabry') {
      router.push('/');
    }
  };

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
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
            title="Back to Dashboard"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <h1 className="text-xl font-bold text-slate-900">Admin Control</h1>
        </div>
      </div>
      <AdminControlTab />
    </div>
  );
}
