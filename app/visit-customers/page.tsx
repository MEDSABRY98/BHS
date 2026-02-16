import VisitCustomersTab from '@/components/VisitCustomersTab';

export const metadata = {
    title: 'Visit Customers - BHS Analysis',
    description: 'Track and report customer visits',
};

export default function VisitCustomersPage() {
    return (
        <main className="min-h-screen bg-slate-50">
            <VisitCustomersTab />
        </main>
    );
}
