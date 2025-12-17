import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  message?: string;
  className?: string;
}

const Loading = ({ message = 'Loading data...', className = '' }: LoadingProps) => {
  return (
    <div className={`min-h-[60vh] flex flex-col items-center justify-center ${className}`}>
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center animate-in fade-in zoom-in duration-300">
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-25"></div>
          <div className="relative bg-indigo-50 p-4 rounded-full">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Please Wait</h3>
        <p className="text-gray-500 text-sm text-center max-w-[200px]">{message}</p>
      </div>
    </div>
  );
};

export default Loading;

