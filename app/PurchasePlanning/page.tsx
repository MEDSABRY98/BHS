import { Suspense } from 'react';
import PurchasePlanningWrapper from './PurchasePlanningWrapper';
import Head from 'next/head';

export default function PurchasePlanningPage() {
  return (
    <>
      <Head>
        <title>Purchase Planning - BHS Hub</title>
      </Head>
      <div className="min-h-screen bg-gray-50/50">
        <Suspense fallback={<div className="flex-1 min-h-screen flex items-center justify-center">Loading...</div>}>
          <PurchasePlanningWrapper />
        </Suspense>
      </div>
    </>
  );
}
