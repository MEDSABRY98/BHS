import { Suspense } from 'react';
import PurchasePlanningWrapper from './PurchasePlanningWrapper';
import MainLoader from '../Components/Loading/MainLoader';
import Head from 'next/head';

export default function PurchasePlanningPage() {
  return (
    <>
      <Head>
        <title>Purchase Planning - BHS Hub</title>
      </Head>
      <div className="min-h-screen bg-gray-50/50">
        <Suspense fallback={<MainLoader />}>
          <PurchasePlanningWrapper />
        </Suspense>
      </div>
    </>
  );
}
