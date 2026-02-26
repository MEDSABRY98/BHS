'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DeliveryTrackingTab from '@/components/DeliveryTrackingTab';
import { ChevronLeft } from 'lucide-react';

export default function DeliveryTrackingPage() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const validateAndSetUser = async () => {
            const savedUser = localStorage.getItem('currentUser');
            const savedPassword = localStorage.getItem('userPassword');

            if (savedUser) {
                const userData = JSON.parse(savedUser);

                // If we also have the password, we can refresh permissions from the API
                if (savedPassword) {
                    try {
                        const response = await fetch('/api/users', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: userData.name,
                                password: savedPassword,
                            }),
                        });

                        const result = await response.json();
                        if (response.ok && result.success) {
                            setCurrentUser(result.user);
                            localStorage.setItem('currentUser', JSON.stringify(result.user));
                            return;
                        }
                    } catch (e) {
                        console.error('Failed to refresh user data:', e);
                    }
                }

                // Fallback to local data if API fails or password missing
                setCurrentUser(userData);
            } else {
                router.push('/');
            }
        };

        validateAndSetUser();
    }, [router]);

    if (!currentUser) return null;

    return (
        <div className="min-h-screen bg-[#F4F7F5]">
            <main className="relative">


                {/* The Main Content */}
                <DeliveryTrackingTab />
            </main>
        </div>
    );
}

