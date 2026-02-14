import React from 'react';

interface LoadingProps {
  message?: string;
  className?: string;
}

const Loading = ({ message = 'Accessing System Data...', className = '' }: LoadingProps) => {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity duration-300 ${className}`}>
      <div className="relative flex flex-col items-center">

        {/* Main Logo Container Animation */}
        <div className="relative w-24 h-24 mb-8">
          {/* Outer Pulsing Rings */}
          <div className="absolute inset-0 rounded-3xl bg-blue-100 animate-ping opacity-20 duration-1000"></div>
          <div className="absolute inset-[-12px] rounded-3xl bg-indigo-50 animate-pulse opacity-30 duration-1500"></div>

          {/* Central Logo Box */}
          <div className="relative w-full h-full bg-slate-900 rounded-2xl shadow-2xl flex items-center justify-center overflow-hidden z-10">
            {/* Animated Shine Effect */}
            <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]"></div>

            {/* Logo Text */}
            <span className="text-3xl font-black text-white tracking-tighter relative z-20">BH</span>
          </div>

          {/* Floating Indicators */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-bounce shadow-sm z-20"></div>
        </div>

        {/* Text Content */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">Processing Request</h3>

          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>
            <span className="text-sm font-medium text-slate-500 tracking-wide uppercase text-xs">Loading Data...</span>
          </div>
        </div>

        {/* New Global Styles for custom animations */}
        <style jsx>{`
          @keyframes shimmer {
            100% {
              left: 100%;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default Loading;
