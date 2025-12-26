'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HomeSelection from '@/components/HomeSelection';
import Login from '@/components/Login';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const validateAndSetUser = async () => {
      const savedUser = localStorage.getItem('currentUser');
      const savedPassword = localStorage.getItem('userPassword');
      
      if (savedUser && savedPassword) {
        try {
          const userData = JSON.parse(savedUser);
          if (userData && userData.name) {
            // Verify user still exists and password is correct
            const response = await fetch('/api/users', {
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
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userPassword');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return <HomeSelection currentUser={currentUser} onLogout={handleLogout} />;
}
