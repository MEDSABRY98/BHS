'use client';

import { useState, useEffect } from 'react';
import PettyCashTab from '@/components/PettyCashTab';
import Login from '@/components/Login';

export default function PettyCashPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

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
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
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

