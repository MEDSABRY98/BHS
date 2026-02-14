'use client';

import { useState, useEffect } from 'react';
import PurchaseQuotationTab from '@/components/PurchaseQuotationTab';
import Login from '@/components/Login';
import Loading from '@/components/Loading';

export default function PurchaseQuotationPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

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
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('userPassword', user.password);
    };

    if (isChecking) {
        return <Loading message="Loading Purchase Quotation Data..." />;
    }

    if (!isAuthenticated) {
        return <Login onLogin={handleLogin} />;
    }

    return <PurchaseQuotationTab />;
}
