'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DocumentsTrackingTab from './Components/DocumentsTrackingTab';
import { useAuditAfterAuth } from '@/app/Audit/Utils/useModuleTabAudit';
import { ChevronLeft } from 'lucide-react';
import MainLoader from '@/app/Components/Loading/MainLoader';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';

export default function DocumentsTrackingPage() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    useSyncLiveUser(setCurrentUser);
    const [isChecking, setIsChecking] = useState(true);
    const router = useRouter();
    useAuditAfterAuth(!!currentUser);

    useEffect(() => {
        const validateAndSetUser = async () => {
            try {
                const user = await restoreSessionUser();
                if (user) {
                    setCurrentUser(user);
                } else {
                    router.push('/');
                }
            } finally {
                setIsChecking(false);
            }
        };

        validateAndSetUser();
    }, [router]);

    if (isChecking) return <MainLoader />;
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
