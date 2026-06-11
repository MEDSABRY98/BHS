'use client';

import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * A modern, minimalist "No Data" component.
 */
interface NoDataProps {
  title?: string;
  message?: string;
}

export default function NoData({ title }: NoDataProps) {
  return (
    <div className="w-full flex flex-col items-center justify-center py-20 px-4">
      <div className="relative group">
        {/* Subtle decorative element */}
        <div className="absolute -inset-4 bg-slate-50 rounded-full scale-0 group-hover:scale-100 transition-transform duration-500" />
        
        <div className="relative flex flex-col items-center gap-6">
          <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-slate-300">
            <Inbox className="w-12 h-12 stroke-[1.2]" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl font-bold text-slate-400 tracking-[0.25em] uppercase">
              {title || "NO DATA FOUND"}
            </span>
            <div className="h-1 w-12 bg-indigo-500/20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
