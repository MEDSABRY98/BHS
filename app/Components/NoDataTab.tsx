'use client';

import { Inbox } from 'lucide-react';

interface NoDataProps {
  title?: string;
}

export default function NoData({ title }: NoDataProps) {
  return (
    <div className="w-full flex flex-col items-center justify-center py-16 px-4">
      <div className="flex flex-col items-center gap-4">
        <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 text-slate-300">
          <Inbox className="w-10 h-10 stroke-[1.2]" />
        </div>
        <span className="text-xl font-bold text-slate-400 tracking-[0.2em] uppercase">
          {title || 'NO DATA FOUND'}
        </span>
      </div>
    </div>
  );
}
