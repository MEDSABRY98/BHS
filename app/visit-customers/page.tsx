'use client';

import { useState, useEffect } from 'react';
import VisitCustomersTab from '@/components/VisitCustomersTab';
import Login from '@/components/Login';
import Loading from '@/components/Loading';

export default function VisitCustomersPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                // We'll just trust the localStorage for simple routing protection
                // Consistent with other pages like Inventory
                JSON.parse(savedUser);
                setIsAuthenticated(true);
            } catch (e) {
                localStorage.removeItem('currentUser');
            } finally {
                setIsChecking(false);
            }
        } else {
            setIsChecking(false);
        }
    }, []);

    const handleLogin = (user: any) => {
        setIsAuthenticated(true);
        localStorage.setItem('currentUser', JSON.stringify(user));
    };

    if (isChecking) {
        return <Loading />;
    }

    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <main className="min-h-screen bg-slate-50">
            <VisitCustomersTab />
        </main>
    );
}
