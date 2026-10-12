import MainLoader from '@/app/Components/Loading/MainLoader';
import { Suspense } from 'react';
import FinancialModelWrapper from './FinancialModelWrapper';

export default function FinancialModelPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Suspense fallback={<MainLoader />}>
        <FinancialModelWrapper />
      </Suspense>
    </div>
  );
}
