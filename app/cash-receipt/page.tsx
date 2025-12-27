'use client';

import { useState, useEffect } from 'react';
import CashReceiptTab from '@/components/CashReceiptTab';
import Login from '@/components/Login';

export default function CashReceiptPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        JSON.parse(savedUser);
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userPassword', user.password);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-white">
      <CashReceiptTab />
    </div>
  );
}

