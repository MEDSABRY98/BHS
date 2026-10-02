import { Suspense } from 'react';
import FinancialModelWrapper from './FinancialModelWrapper';

export default function FinancialModelPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <Suspense fallback={<div className="flex-1 min-h-screen flex items-center justify-center">Loading...</div>}>
        <FinancialModelWrapper />
      </Suspense>
    </div>
  );
}
