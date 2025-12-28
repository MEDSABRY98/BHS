'use client';

import { useState, useEffect } from 'react';
import ProductAnalyzer from '@/components/ProductAnalyzerTab';
import Login from '@/components/Login';

export default function InventoryPage() {
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
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <ProductAnalyzer />
    </div>
  );
}

