'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HomeSelection from '@/app/Components/Layout/HomeSelection';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import { restoreSessionUser, logoutEverywhere } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  useSyncLiveUser(setCurrentUser);

  useEffect(() => {
    const validateAndSetUser = async () => {
      setIsLoading(true);
      const user = await restoreSessionUser();
      if (user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
      }

      // Ensure loading shows for at least 800ms for a smoother transition as requested
      setTimeout(() => {
        setIsLoading(false);
      }, 800);
    };

    validateAndSetUser();
  }, []);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    void logoutEverywhere();
  };

  if (isLoading) {
    return <MainLoader />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return <HomeSelection currentUser={currentUser} onLogout={handleLogout} />;
}
