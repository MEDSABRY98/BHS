'use client';

import React from 'react';

interface DataLoaderProps {
  message?: string;
  className?: string;
}

export default function DataLoader({ message = 'Loading Data...', className = '' }: DataLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[200px] w-full ${className}`}>
      {/* Container for the loader animation */}
      <div className="relative flex items-center justify-center w-16 h-16 mb-4">
        {/* Outer glowing ring */}
        <div className="absolute inset-0 rounded-full border-[2px] border-[#D4AF37]/10" />
        
        {/* Spinning gradient ring */}
        <div className="absolute inset-0 rounded-full border-[2px] border-transparent border-t-[#D4AF37] border-r-[#D4AF37]/50 animate-spin" style={{ animationDuration: '1s' }} />
        
        {/* Inner static core */}
        <div className="absolute w-2 h-2 bg-[#D4AF37] rounded-full animate-pulse" />
      </div>
      
      {/* Text message */}
      <div className="text-xs font-bold tracking-widest text-slate-500 uppercase animate-pulse">
        {message}
      </div>
    </div>
  );
}
