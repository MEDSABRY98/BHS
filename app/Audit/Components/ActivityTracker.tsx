'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { InitActivityQueue, TrackModuleVisit } from '../Utils/ActivityQueue';

export default function ActivityTracker() {
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    InitActivityQueue();
  }, []);

  useEffect(() => {
    if (!pathname || pathname === previousPath.current) return;
    previousPath.current = pathname;
    TrackModuleVisit(pathname);
  }, [pathname]);

  return null;
}
