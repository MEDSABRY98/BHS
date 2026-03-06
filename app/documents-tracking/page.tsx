'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DocumentsTrackingTab from '@/components/DocumentsTracking/DocumentsTrackingTab';
import { ChevronLeft } from 'lucide-react';
import Loading from '@/components/Loading';

export default function DocumentsTrackingPage() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isChecking, setIsChecking] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const validateAndSetUser = async () => {
            try {
                const savedUser = localStorage.getItem('currentUser');
                const savedPassword = localStorage.getItem('userPassword');

                if (savedUser) {
                    const userData = JSON.parse(savedUser);

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
                    setCurrentUser(userData);
                } else {
                    router.push('/');
                }
            } finally {
                setIsChecking(false);
            }
        };

        validateAndSetUser();
    }, [router]);

    if (isChecking) return <Loading message="جاري التحقق من الصلاحيات..." />;
    if (!currentUser) return null;

    return (
        <div className="min-h-screen bg-[#F4F7F5]">
            <main className="relative">
                <div className="absolute top-4 left-4 z-50">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors shadow-lg"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        العودة للرئيسية
                    </button>
                </div>
                <DocumentsTrackingTab />
            </main>
        </div>
    );
}
