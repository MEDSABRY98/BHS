'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DocumentsTrackingTab from './Components/DocumentsTrackingTab';
import { useAuditAfterAuth } from '@/app/Audit/Utils/useModuleTabAudit';
import { ChevronLeft } from 'lucide-react';
import Loading from '@/app/Components/Loading';
import { verifyUserCredentials } from '@/app/DataBase/Service/database_service';

export default function DocumentsTrackingPage() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isChecking, setIsChecking] = useState(true);
    const router = useRouter();
    useAuditAfterAuth(!!currentUser);

    useEffect(() => {
        const validateAndSetUser = async () => {
            try {
                const savedUser = localStorage.getItem('currentUser');
                const savedPassword = localStorage.getItem('userPassword');

                if (savedUser) {
                    const userData = JSON.parse(savedUser);

                    if (savedPassword) {
                        try {
                            const result = await verifyUserCredentials(userData.name, savedPassword);
                            if (result.success && result.user) {
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
                <DocumentsTrackingTab currentUser={currentUser} />
            </main>
        </div>
    );
}
