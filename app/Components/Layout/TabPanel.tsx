'use client';

import { useEffect, useRef } from 'react';

interface TabPanelProps {
  tabId: string;
  activeTab: string;
  isVisited: boolean;
  children: React.ReactNode;
}

export default function TabPanel({ tabId, activeTab, isVisited, children }: TabPanelProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const isActive = activeTab === tabId;

  useEffect(() => {
    if (!isActive || !innerRef.current) return;

    const el = innerRef.current;
    el.classList.remove('animate-sales-tab-enter');
    void el.offsetWidth;
    el.classList.add('animate-sales-tab-enter');
  }, [isActive, activeTab, tabId]);

  if (!isVisited) return null;

  return (
    <div className={isActive ? 'block' : 'hidden'} aria-hidden={!isActive}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
