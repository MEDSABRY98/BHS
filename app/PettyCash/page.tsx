'use client';

import { useState, useEffect } from 'react';
import PettyCashTab from './Components/PettyCashTab';
import { useAuditAfterAuth } from '@/app/Audit/Utils/useModuleTabAudit';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';
import { verifyUserCredentials } from '@/app/DataBase/Service/database_service';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';

export default function PettyCashPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  useAuditAfterAuth(isAuthenticated);

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
              const result = await verifyUserCredentials(userData.name, savedPassword);

              if (result.success && result.user) {
                // User still exists and credentials are valid
                setCurrentUser(result.user);
                setIsAuthenticated(true);
                // Update localStorage with fresh user data
                localStorage.setItem('currentUser', JSON.stringify(result.user));
              } else {
                // User deleted or password changed, clear localStorage
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
    return <Loading message="Loading Petty Cash Data..." />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-white">
      <PettyCashTab />
    </div>
  );
}

