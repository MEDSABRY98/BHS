'use client';

import TabLoader from '@/app/Components/Loading/TabLoader';

export default function SalesTabLoader({ className = '' }: { className?: string }) {
  return <TabLoader className={className} />;
}
