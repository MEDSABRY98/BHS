'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DeliveryTrackingTab from '@/components/DeliveryTrackingTab';
import { ChevronLeft } from 'lucide-react';

export default function DeliveryTrackingPage() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            setCurrentUser(JSON.parse(savedUser));
        } else {
            router.push('/');
        }
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

