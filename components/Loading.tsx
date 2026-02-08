import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  message?: string;
  className?: string;
}

const Loading = ({ message = 'Loading data...', className = '' }: LoadingProps) => {
  return (
    <div className={`min-h-[60vh] flex flex-col items-center justify-center ${className}`}>
      <div className="relative flex flex-col items-center p-8">
        {/* Modern minimal spinner */}
        <div className="relative w-16 h-16 mb-6">
          {/* Background Drop */}
          <div className="absolute inset-0 bg-blue-50 rounded-full blur-xl opacity-50 animate-pulse"></div>

          {/* Spinning Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>

          {/* Active Segment */}
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>

          {/* Inner Pulse */}
          <div className="absolute inset-4 rounded-full bg-white shadow-sm flex items-center justify-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Text Content */}
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-lg font-medium text-slate-700 tracking-tight">Please Wait</h3>
          <div className="flex items-center gap-1">
            <span className="text-sm text-slate-400 font-light">Loading data</span>
            <span className="flex gap-0.5 mt-1">
              <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Loading;

