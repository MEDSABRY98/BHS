import DataLoader from '@/app/Components/Loading/DataLoader';
import { Suspense } from 'react';
import FinancialModelWrapper from './FinancialModelWrapper';

export default function FinancialModelPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-screen"><DataLoader message="" /></div>}>
        <FinancialModelWrapper />
      </Suspense>
    </div>
  );
}
