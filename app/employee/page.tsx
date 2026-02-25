'use client';

import { useState, useEffect } from 'react';
import EmployeeTab from '@/components/EmployeeTab';
import Login from '@/components/Login';
import Loading from '@/components/Loading';

export default function EmployeePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

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
        } finally {
          setIsChecking(false);
        }
      } else {
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
    return <Loading message="Authenticating..." />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-white">
      <EmployeeTab />
    </div>
  );
}

